'use strict';
// Staging-only persistence. Caller injects workbook, exclusive project lock and SHA-256.
const Domain=require('./order-work.cjs');
const HEADERS=['attempt_id','kind','chunk_index','chunk_count','checksum','payload'];
const LEGACY_IDS=['1Nuwjjj2HpirYJA9YUppkQ_kSVpVo6LH4ShN14NkOMZU','1ACsqTWveQR3ksIwE3bkQcN7RNI1a7MymtOOgJRp72yw','1tHd_ypY36P0cyFFcPoDjVuPobU2y4k1__nR4cLZdsYY','1-j45sURspD4PvrymNp8P2gLwrebFRVt9Rbo3AwEiDWw','1R5YaLosDq7fhUJuulfjXoJYEOA4tZief5Ge5qaL_jrs'];
function fail(code){const e=new Error(code);e.code=code;throw e;}
function splitText(raw){const chunks=[];for(let start=0;start<raw.length;){let end=Math.min(start+16000,raw.length);const last=raw.charCodeAt(end-1);if(end<raw.length&&last>=0xD800&&last<=0xDBFF)end--;chunks.push(raw.slice(start,end));start=end;}return chunks;}
class SheetsRepository {
  constructor({workbook,stagingId,markerToken,withLock,hash,id,flush=()=>{},fault=()=>{},maxRows=10000,maxChars=1000000,retainSnapshots=20,compactThreshold=retainSnapshots+10,timing=()=>{},domain=Domain}) {
    if(!stagingId||LEGACY_IDS.includes(stagingId)||workbook.getId()!==stagingId)fail('STAGING_TARGET_REJECTED');
    if(!markerToken||typeof withLock!=='function'||typeof hash!=='function'||typeof id!=='function')fail('STAGING_CONFIG_REQUIRED');
    if(!Number.isSafeInteger(maxRows)||maxRows<2||!Number.isSafeInteger(maxChars)||maxChars<1)fail('INVALID_LIMIT');
    Object.assign(this,{workbook,markerToken,withLock,hash,id,flush,fault,maxRows,maxChars,retainSnapshots,compactThreshold,timing,domain});
    if(!Number.isSafeInteger(compactThreshold)||compactThreshold<retainSnapshots||!Number.isSafeInteger(retainSnapshots)||retainSnapshots<1)fail('INVALID_LIMIT');
    this.validate();
  }
  validate(){
    const meta=this.workbook.getSheetByName('ERP_META');
    if(!meta)fail('STAGING_MARKER_REQUIRED');
    const values=meta.getRange(1,1,2,2).getDisplayValues();
    if(JSON.stringify(values)!==JSON.stringify([['environment','token'],['STAGING',this.markerToken]]))fail('STAGING_MARKER_MISMATCH');
    for(const name of ['ERP_STATE','ERP_JOURNAL']) {
      const sheet=this.workbook.getSheetByName(name);
      if(!sheet||JSON.stringify(sheet.getRange(1,1,1,6).getDisplayValues()[0])!==JSON.stringify(HEADERS))fail('SCHEMA_MISMATCH');
    }
  }
  rows(name){const s=this.workbook.getSheetByName(name),n=s.getLastRow();if(n>this.maxRows)fail('STAGING_CAPACITY_EXCEEDED');return n<2?[]:s.getRange(2,1,n-1,6).getValues().map((cells,i)=>({cells,row:i+2}));}
  ensureRows(sheet,end,limit=this.maxRows){
    if(end>limit)fail('STAGING_CAPACITY_EXCEEDED');
    if(end>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),end-sheet.getMaxRows());
  }
  capacity(snapshot){
    const tabs=['ERP_STATE','ERP_JOURNAL','ERP_ARCHIVE'].map(name=>{const sheet=this.workbook.getSheetByName(name);return {name,rows:sheet?sheet.getLastRow():0,limit:name==='ERP_ARCHIVE'?null:this.maxRows};});
    const chars=JSON.stringify(snapshot).length;
    return {tabs,snapshot_chars:chars,max_chars:this.maxChars,warning:chars>this.maxChars*.7||tabs.some(t=>t.limit&&t.rows>t.limit*.7)};
  }
  // Called only under the project lock. Delete complete attempts in one Sheets operation.
  // Copy + verify before deletion; an interrupted archive copy is invisible until its marker.
  manifestRows(name){const sheet=this.workbook.getSheetByName(name),n=sheet.getLastRow();if(n>this.maxRows)fail('STAGING_CAPACITY_EXCEEDED');return n<2?[]:sheet.getRange(2,1,n-1,5).getValues().map((cells,i)=>({cells,row:i+2}));}
  attemptRows(name,manifest){const sheet=this.workbook.getSheetByName(name),count=manifest.cells[3];if(!Number.isSafeInteger(count)||count<1||manifest.row-count<2)fail('RECOVERY_CONFLICT');return sheet.getRange(manifest.row-count,1,count+1,6).getValues().map((cells,i)=>({cells,row:manifest.row-count+i}));}
  compactLocked(force=false){
    const started=Date.now(),headers=this.manifestRows('ERP_STATE'),markers=headers.filter(r=>r.cells[1]==='SNAPSHOT');
    if(!force&&markers.length<=this.compactThreshold)return false;
    if(markers.length<=this.retainSnapshots)return false;
    const states=this.rows('ERP_STATE');
    // New manifests contain revision. Old manifests are decoded only during this migration/maintenance pass.
    const entries=states.filter(r=>r.cells[1]==='SNAPSHOT').map(m=>{let meta;try{meta=JSON.parse(m.cells[5]);}catch(e){fail('RECOVERY_CONFLICT');}return {m,revision:meta.revision??this.decode(states,m).revision};}).sort((a,b)=>b.revision-a.revision);
    const cutoff=entries[this.retainSnapshots-1].revision;
    const remove=(name,attempt)=>{const rows=this.manifestRows(name).filter(r=>r.cells[0]===attempt);if(!rows.length)return;if(rows.some((r,i)=>r.row!==rows[0].row+i))fail('RECOVERY_CONFLICT');this.fault('compact_before_delete_'+name);this.workbook.getSheetByName(name).deleteRows(rows[0].row,rows.length);this.flush();this.fault('compact_after_delete_'+name);};
    const journal=this.rows('ERP_JOURNAL');
    for(const marker of journal.filter(r=>r.cells[1]==='COMMITTED')){
      let meta;try{meta=JSON.parse(marker.cells[5]);}catch(e){fail('RECOVERY_CONFLICT');}
      if((meta.revision??meta.before_revision+1)>=cutoff)continue;
      const value=this.decode(journal,marker),block=journal.filter(r=>r.cells[0]===marker.cells[0]).map(r=>r.cells);
      let archive=this.workbook.getSheetByName('ERP_ARCHIVE');if(!archive)archive=this.workbook.insertSheet('ERP_ARCHIVE');if(!archive.getLastRow())archive.getRange(1,1,1,6).setValues([HEADERS]);
      if(JSON.stringify(archive.getRange(1,1,1,6).getDisplayValues()[0])!==JSON.stringify(HEADERS))fail('SCHEMA_MISMATCH');
      // Archive oldest-first, remove each journal only after verification. A retry can only find
      // this attempt at the tail, complete or partially copied; never scan the growing archive.
      const n=archive.getLastRow(),start=Math.max(2,n-block.length+1),tail=n<2?[]:archive.getRange(start,1,n-start+1,6).getValues().map((cells,i)=>({cells,row:start+i})),saved=tail.filter(r=>r.cells[0]===marker.cells[0]),existing=saved.find(r=>r.cells[1]==='COMMITTED');
      if(existing){if(this.hash(JSON.stringify(this.decode(saved,existing)))!==this.hash(JSON.stringify(value)))fail('RECOVERY_CONFLICT');}
      else{if(saved.length){if(saved.at(-1).row!==n||saved.some((r,i)=>r.row!==saved[0].row+i))fail('RECOVERY_CONFLICT');archive.deleteRows(saved[0].row,saved.length);}const at=archive.getLastRow()+1;this.ensureRows(archive,at+block.length-1,Number.MAX_SAFE_INTEGER);archive.getRange(at,1,block.length,6).setValues(block);this.flush();this.fault('compact_after_archive');const copied=archive.getRange(at,1,block.length,6).getValues().map((cells,i)=>({cells,row:at+i}));if(this.hash(JSON.stringify(this.decode(copied,copied.at(-1))))!==this.hash(JSON.stringify(value)))fail('RECOVERY_CONFLICT');}
      remove('ERP_JOURNAL',marker.cells[0]);
    }
    for(const entry of entries.filter(x=>x.revision<cutoff))remove('ERP_STATE',entry.m.cells[0]);
    this.timing({phase:'compact',ms:Date.now()-started});return true;
  }
  decode(rows,manifest){
    const [attempt,, ,count,checksum]=manifest.cells;
    if(!Number.isSafeInteger(count)||count<1||count>Math.ceil(this.maxChars/15999))fail('RECOVERY_CONFLICT');
    const chunks=rows.filter(r=>r.cells[0]===attempt&&r.cells[1]==='DATA').map(r=>r.cells);
    if(chunks.length!==count)fail('RECOVERY_CONFLICT');
    chunks.sort((a,b)=>a[2]-b[2]);
    if(chunks.some((r,i)=>r[2]!==i||r[3]!==count||r[4]!==checksum||typeof r[5]!=='string'))fail('RECOVERY_CONFLICT');
    const raw=chunks.map(r=>r[5]).join('');if(raw.length>this.maxChars||this.hash(raw)!==checksum)fail('RECOVERY_CONFLICT');
    try{return JSON.parse(raw);}catch(e){fail('RECOVERY_CONFLICT');}
  }
  latest(name,kinds){
    const manifests=this.manifestRows(name).filter(r=>kinds.includes(r.cells[1]));if(name==='ERP_STATE')this.snapshotCount=manifests.length;if(!manifests.length)return null;
    // Append-only manifests are the visibility boundary. Read the latest complete block only.
    const marker=manifests.at(-1),rows=this.attemptRows(name,marker),manifest=rows.at(-1),value=this.decode(rows,manifest);
    if(!Number.isSafeInteger(value.revision)||value.revision<1)fail('RECOVERY_CONFLICT');return {manifest,value};
  }
  append(name,value,kind,metadata){
    const raw=JSON.stringify(value);if(raw.length>this.maxChars)fail('STAGING_CAPACITY_EXCEEDED');
    const parts=splitText(raw),count=parts.length,checksum=this.hash(raw),attempt=this.id();
    if(this.manifestRows(name).some(r=>r.cells[0]===attempt))fail('DUPLICATE_ATTEMPT_ID');
    const sheet=this.workbook.getSheetByName(name),start=sheet.getLastRow()+1;
    this.ensureRows(sheet,start+count);
    // DATA can be partially written. A flushed, verified manifest is the visibility boundary.
    const chunks=Array.from({length:count},(_,i)=>[attempt,'DATA',i,count,checksum,parts[i]]);
    sheet.getRange(start,1,count,6).setValues(chunks);this.flush();this.fault(name+'_after_chunks');
    const marker=[attempt,kind,-1,count,checksum,JSON.stringify({...metadata,revision:value.revision})];
    sheet.getRange(start+count,1,1,6).setValues([marker]);this.flush();
    const m={cells:marker,row:start+count};if(this.hash(JSON.stringify(this.decode(this.attemptRows(name,m),m)))!==this.hash(raw))fail('RECOVERY_CONFLICT');
    return m;
  }
  recoverLocked(){
    const readAt=Date.now(),stateEntry=this.latest('ERP_STATE',['SNAPSHOT']);
    let current=stateEntry?stateEntry.value:{revision:0,state:this.domain.emptyState()};
    const intent=this.latest('ERP_JOURNAL',['PREPARED','COMMITTED']);this.timing({phase:'snapshot_read',ms:Date.now()-readAt});
    if(!intent){if(current.revision!==0)fail('RECOVERY_CONFLICT');return current;}
    let meta;try{meta=JSON.parse(intent.manifest.cells[5]);}catch(e){fail('RECOVERY_CONFLICT');}
    const after=intent.value;
    if(meta.after_hash!==this.hash(JSON.stringify(after))||meta.before_revision!==after.revision-1)fail('RECOVERY_CONFLICT');
    if(intent.manifest.cells[1]==='COMMITTED') {
      if(current.revision!==after.revision||this.hash(JSON.stringify(current))!==meta.after_hash)fail('RECOVERY_CONFLICT');return current;
    }
    if(current.revision===meta.before_revision&&this.hash(JSON.stringify(current))===meta.before_hash){this.append('ERP_STATE',after,'SNAPSHOT');current=after;}
    else if(current.revision!==after.revision||this.hash(JSON.stringify(current))!==meta.after_hash)fail('RECOVERY_CONFLICT');
    this.workbook.getSheetByName('ERP_JOURNAL').getRange(intent.manifest.row,2,1,1).setValues([['COMMITTED']]);this.flush();
    return current;
  }
  recover(){return this.withLock(()=>this.recoverLocked());}
  snapshot(){return this.recover();}
  submit(command,context){const requested=Date.now(),metrics={lock_wait:0,recover:0,compact:0,domain:0,journal:0,state:0,commit:0};const phase=(name,fn)=>{const start=Date.now();try{return fn();}finally{metrics[name]=(metrics[name]||0)+Date.now()-start;}};try{return this.withLock(()=>{metrics.lock_wait=Date.now()-requested;
    const readStarted=Date.now(),before=phase('recover',()=>this.recoverLocked());if(context.onSnapshotRead)context.onSnapshotRead(Date.now()-readStarted);const output=phase('domain',()=>this.domain.execute(before.state,command,context));
    if(output.result.replayed){if(context.onCommitted)context.onCommitted(before);return output.result;}
    const after={revision:before.revision+1,state:output.state};
    // Preflight capacity on both tabs before recording durable intent.
    const raw=JSON.stringify(after);if(raw.length>this.maxChars)fail('STAGING_CAPACITY_EXCEEDED');
    const needed=splitText(raw).length+1;
    for(const n of ['ERP_STATE','ERP_JOURNAL']){const s=this.workbook.getSheetByName(n);this.ensureRows(s,s.getLastRow()+needed);}
    const meta={before_revision:before.revision,before_hash:this.hash(JSON.stringify(before)),after_hash:this.hash(raw)};
    const journal=phase('journal',()=>this.append('ERP_JOURNAL',after,'PREPARED',meta));this.fault('after_prepare');
    phase('state',()=>this.append('ERP_STATE',after,'SNAPSHOT'));this.fault('after_state');
    phase('commit',()=>{this.workbook.getSheetByName('ERP_JOURNAL').getRange(journal.row,2,1,1).setValues([['COMMITTED']]);this.flush();});this.fault('after_commit');
    if((this.snapshotCount||0)+1>this.compactThreshold)phase('compact',()=>this.compactLocked());
    if(context.onCommitted)context.onCommitted(after);return output.result;
  });}finally{this.timing({phase:'command',...metrics,total:Date.now()-requested});}}
}
module.exports={SheetsRepository,HEADERS};
