'use strict';
// Staging-only persistence. Caller injects workbook, exclusive project lock and SHA-256.
const Domain=require('./order-work.cjs');
const HEADERS=['attempt_id','kind','chunk_index','chunk_count','checksum','payload'];
const LEGACY_IDS=['1Nuwjjj2HpirYJA9YUppkQ_kSVpVo6LH4ShN14NkOMZU','1ACsqTWveQR3ksIwE3bkQcN7RNI1a7MymtOOgJRp72yw','1tHd_ypY36P0cyFFcPoDjVuPobU2y4k1__nR4cLZdsYY','1-j45sURspD4PvrymNp8P2gLwrebFRVt9Rbo3AwEiDWw','1R5YaLosDq7fhUJuulfjXoJYEOA4tZief5Ge5qaL_jrs'];
function fail(code){const e=new Error(code);e.code=code;throw e;}
function splitText(raw){const chunks=[];for(let start=0;start<raw.length;){let end=Math.min(start+16000,raw.length);const last=raw.charCodeAt(end-1);if(end<raw.length&&last>=0xD800&&last<=0xDBFF)end--;chunks.push(raw.slice(start,end));start=end;}return chunks;}
class SheetsRepository {
  constructor({workbook,stagingId,markerToken,withLock,hash,id,flush=()=>{},fault=()=>{},maxRows=10000,maxChars=1000000,domain=Domain}) {
    if(!stagingId||LEGACY_IDS.includes(stagingId)||workbook.getId()!==stagingId)fail('STAGING_TARGET_REJECTED');
    if(!markerToken||typeof withLock!=='function'||typeof hash!=='function'||typeof id!=='function')fail('STAGING_CONFIG_REQUIRED');
    if(!Number.isSafeInteger(maxRows)||maxRows<2||!Number.isSafeInteger(maxChars)||maxChars<1)fail('INVALID_LIMIT');
    Object.assign(this,{workbook,markerToken,withLock,hash,id,flush,fault,maxRows,maxChars,domain});
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
    const rows=this.rows(name);const manifests=rows.filter(r=>kinds.includes(r.cells[1]));
    if(!manifests.length)return null;
    const decoded=manifests.map(m=>({manifest:m,value:this.decode(rows,m)}));
    if(decoded.some(x=>!Number.isSafeInteger(x.value.revision)||x.value.revision<1))fail('RECOVERY_CONFLICT');
    decoded.sort((a,b)=>b.value.revision-a.value.revision);
    const highest=decoded[0];if(decoded.some(x=>x.value.revision===highest.value.revision&&this.hash(JSON.stringify(x.value))!==this.hash(JSON.stringify(highest.value))))fail('RECOVERY_CONFLICT');
    return highest;
  }
  append(name,value,kind,metadata){
    const raw=JSON.stringify(value);if(raw.length>this.maxChars)fail('STAGING_CAPACITY_EXCEEDED');
    const parts=splitText(raw),count=parts.length,checksum=this.hash(raw),attempt=this.id();
    if(this.rows(name).some(r=>r.cells[0]===attempt))fail('DUPLICATE_ATTEMPT_ID');
    const sheet=this.workbook.getSheetByName(name),start=sheet.getLastRow()+1;
    if(start+count>this.maxRows||start+count>sheet.getMaxRows())fail('STAGING_CAPACITY_EXCEEDED');
    // DATA can be partially written. A flushed, verified manifest is the visibility boundary.
    const chunks=Array.from({length:count},(_,i)=>[attempt,'DATA',i,count,checksum,parts[i]]);
    sheet.getRange(start,1,count,6).setValues(chunks);this.flush();this.fault(name+'_after_chunks');
    const marker=[attempt,kind,-1,count,checksum,JSON.stringify(metadata||{})];
    sheet.getRange(start+count,1,1,6).setValues([marker]);this.flush();
    const m={cells:marker,row:start+count};if(this.hash(JSON.stringify(this.decode(this.rows(name),m)))!==this.hash(raw))fail('RECOVERY_CONFLICT');
    return m;
  }
  recoverLocked(){
    this.validate();
    const stateEntry=this.latest('ERP_STATE',['SNAPSHOT']);
    let current=stateEntry?stateEntry.value:{revision:0,state:this.domain.emptyState()};
    const intent=this.latest('ERP_JOURNAL',['PREPARED','COMMITTED']);
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
  submit(command,context){return this.withLock(()=>{
    const readStarted=Date.now(),before=this.recoverLocked();if(context.onSnapshotRead)context.onSnapshotRead(Date.now()-readStarted);const output=this.domain.execute(before.state,command,context);
    if(output.result.replayed){if(context.onCommitted)context.onCommitted(before);return output.result;}
    const after={revision:before.revision+1,state:output.state};
    // Preflight capacity on both tabs before recording durable intent.
    const raw=JSON.stringify(after);if(raw.length>this.maxChars)fail('STAGING_CAPACITY_EXCEEDED');
    const needed=splitText(raw).length+1;
    for(const n of ['ERP_STATE','ERP_JOURNAL']){const s=this.workbook.getSheetByName(n);if(s.getLastRow()+needed>Math.min(this.maxRows,s.getMaxRows()))fail('STAGING_CAPACITY_EXCEEDED');}
    const meta={before_revision:before.revision,before_hash:this.hash(JSON.stringify(before)),after_hash:this.hash(raw)};
    const journal=this.append('ERP_JOURNAL',after,'PREPARED',meta);this.fault('after_prepare');
    this.append('ERP_STATE',after,'SNAPSHOT');this.fault('after_state');
    this.workbook.getSheetByName('ERP_JOURNAL').getRange(journal.row,2,1,1).setValues([['COMMITTED']]);this.flush();this.fault('after_commit');
    if(context.onCommitted)context.onCommitted(after);return output.result;
  });}
}
module.exports={SheetsRepository,HEADERS};
