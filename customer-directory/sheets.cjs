"use strict";
const C = require("./core.cjs"), { stable, query } = require("./repository.cjs");
const SCHEMA = {
  KHACH: ["MA_KHACH", "LOAI", "TEN", "MST", "DIEN_THOAI", "EMAIL", "DIA_CHI", "NGUOI_LIEN_HE", "CHO_PHEP_NO", "TRANG_THAI", "GOP_VAO", "MA_CU", "VERSION", "TAO_LUC", "TAO_BOI", "CAP_NHAT_LUC", "CAP_NHAT_BOI", "HAN_MUC_NO", "GHI_CHU"],
  LICH_SU: ["ID", "LOAI", "MA_KHACH", "TRUOC", "SAU", "AI", "LUC", "LY_DO"],
  CHI_MUC: ["ID", "LOAI", "GIA_TRI", "KHONG_DAU", "MA_KHACH"],
  NGUON: ["ID", "APP", "MA_CU", "DU_LIEU"],
  DUYET_TRUNG: ["ID", "CO_CONG_NO_MO", "SO_DONG", "LUA_CHON_NHAP", "QUYET_DINH", "KT_DUYET_BOI", "GD_XAC_NHAN_BOI", "VERSION", "CHI_TIET", "LY_DO_NHAP", "DONG_NGUON"],
  ANH_XA: ["ID", "APP", "MA_CU", "MA_KHACH"],
  CD_RECEIPTS: ["KEY", "HASH", "RESULT", "REVISION"],
  CD_JOURNAL: ["TX", "KIND", "INDEX", "COUNT", "HASH", "PAYLOAD"],
  CD_META: ["KEY", "VALUE"]
};
const ORIGINAL_IDS = ["1tHd_ypY36P0cyFFcPoDjVuPobU2y4k1__nR4cLZdsYY", "1-j45sURspD4PvrymNp8P2gLwrebFRVt9Rbo3AwEiDWw", "1R5YaLosDq7fhUJuulfjXoJYEOA4tZief5Ge5qaL_jrs", "1Nuwjjj2HpirYJA9YUppkQ_kSVpVo6LH4ShN14NkOMZU", "1ACsqTWveQR3ksIwE3bkQcN7RNI1a7MymtOOgJRp72yw"];
function rowsFor(d) {
  return { KHACH: Object.values(d.customers).map((c) => SCHEMA.KHACH.map((k) => k === "DIEN_THOAI" || k === "MA_CU" ? c[k].join("; ") : k === "NGUOI_LIEN_HE" ? JSON.stringify(c[k]) : c[k] ?? "")), LICH_SU: d.history.map((e) => SCHEMA.LICH_SU.map((k) => ["TRUOC", "SAU"].includes(k) ? JSON.stringify(e[k]) : e[k] ?? "")), NGUON: Object.values(d.sources).map((r) => [r.key, r.app, r.ma_cu, JSON.stringify(r)]), DUYET_TRUNG: Object.values(d.reviews).map((r) => [r.id, r.open_debt ? "Có" : "Không", r.keys.length, "", r.decision === "CUNG_KHACH" ? "Cùng khách" : r.decision === "KHAC_KHACH" ? "Khác khách" : "", r.approved_by || "", r.director_by || "", r.VERSION, JSON.stringify(r), "", (r.rows || []).map((x) => [x.app, x.ma_cu, x.TEN, x.DIEN_THOAI.join(", "), x.MST, x.DIA_CHI, x.open_debt ? "Có nợ mở" : ""].join(" | ")).join("\n")]), ANH_XA: Object.entries(d.mappings).map(([key, code]) => {
    const i = key.indexOf(":");
    return [key, key.slice(0, i), key.slice(i + 1), code];
  }) };
}
class SheetsDriver {
  constructor({ workbook, workbookId, scriptId, marker, properties, lock, tryReadLock, writeRows, flush, hash, id, fault = () => {
  } }) {
    if (!workbookId || workbookId !== workbook.getId() || ORIGINAL_IDS.includes(workbookId)) C.fail("COPY_TARGET_REQUIRED");
    Object.assign(this, { wb: workbook, scriptId, marker, props: properties, lock, tryReadLock, writeRows, flush, hash, id, fault });
    this.cache = new Map(); this.depth = 0; this.started = false; this.timings = [];
    this.validate();
  }
  beginRequest() {
    if (this.depth) {
      (this.parents ||= []).push({cache:this.cache, validated:this.validated, timings:this.timings, legacyRevisions:this.legacyRevisions});
      this.cache = new Map(); this.validated = false; this.timings = []; this.legacyRevisions = undefined;
    } else if (this.started) { this.cache = new Map(); this.validated = false; this.timings = []; this.legacyRevisions = undefined; }
    this.started = true; this.depth++;
  }
  recordTiming(phase, ms) { this.timings.push({phase, ms}); }
  measure(phase, fn) { const start=Date.now(); try {return fn();} finally {this.recordTiming(phase, Date.now()-start);} }
  values(name) {
    if (!this.cache.has(name)) {
      const values = this.table(name).getDataRange().getDisplayValues();
      if (stable(values[0]?.slice(0, SCHEMA[name].length)) !== stable(SCHEMA[name])) C.fail('SCHEMA_MISMATCH');
      this.cache.set(name, values);
    }
    return this.cache.get(name);
  }
  entries(name) {
    return this.values(name).slice(1).map((row, i) => ({row:i+2, values:SCHEMA[name].map((_, j) => row[j] ?? '')})).filter(x=>x.values.some(v=>v!==''));
  }
  write(name, start, rows) {
    this.writeRows(this.table(name), start, rows);
    if (this.cache.has(name)) {
      const values=this.cache.get(name);
      rows.forEach((row,i)=>values[start+i-1]=row.map(v=>String(v ?? '')));
    }
  }
  clear(name, start, count) {
    this.table(name).getRange(start,1,count,SCHEMA[name].length).clearContent();
    if(this.cache.has(name)) for(let i=0;i<count;i++)this.cache.get(name)[start+i-1]=Array(SCHEMA[name].length).fill('');
  }
  table(name) {
    const s = this.wb.getSheetByName(name);
    if (!s) C.fail("SCHEMA_MISMATCH");
    return s;
  }
  rows(name) {
    return this.entries(name).map(x=>x.values);
  }
  meta(key) { const r=this.rows('CD_META').find(r=>r[0]===key); return r?r[1]:null; }
  setMeta(key, value) {
    const rows=this.entries('CD_META'), found=rows.find(x=>x.values[0]===key);
    this.write('CD_META',found?found.row:this.table('CD_META').getLastRow()+1,[[key,String(value)]]);
  }
  validate() {
    if (this.validated) return;
    const meta = Object.fromEntries(this.rows("CD_META")), revision = meta.REVISION;
    if (revision === undefined || !/^\d+$/.test(revision) || !Number.isSafeInteger(Number(revision))) C.fail("META_CORRUPT");
    if (!this.marker || meta.ENV !== "COPY" || meta.SCRIPT_ID !== this.scriptId || meta.TOKEN !== this.marker) C.fail("COPY_MARKER_MISMATCH");
    this.validated = true;
  }
  endRequest() {
    this.lastTimings = [...this.timings];
    this.depth=Math.max(0,this.depth-1);
    if(this.depth)Object.assign(this,this.parents.pop());
    else {this.validated=false;this.cache=new Map();this.timings=[];this.legacyRevisions=undefined;}
  }
  journalFence() {
    const sheet = this.table("CD_JOURNAL"), row = sheet.getLastRow();
    return { row, committed: row <= 1 || sheet.getRange(row, 2, 1, 1).getDisplayValues()[0][0] === "COMMITTED" };
  }
  readConsistent(action, payload) {
    this.validate();
    const epoch=this.props.getProperty('CD_COMMIT_REVISION'), before = this.journalFence();
    if (before.committed) {
      const result = this.query(action, payload);
      if (this.table('CD_JOURNAL').getLastRow() === before.row && this.props.getProperty('CD_COMMIT_REVISION')===epoch) return result;
    }
    this.cache=new Map();this.validated=false;this.validate();
    if (this.tryReadLock) {
      const recovered=this.tryReadLock(()=>{this.recover();return this.query(action,payload);});
      if(recovered)return recovered;
    }
    // A pending delta includes full before-images in its history. Roll back only
    // its affected customers in memory; no dependency on pruned journal prefixes.
    const fence=this.props.getProperty('CD_COMMIT_REVISION'), tx=this.transactions();
    const state=C.initial();state.customers=Object.fromEntries(this.customerMap());state.revision=Number(this.meta('REVISION')||0);
    const pending=tx.filter(x=>!x.committed).sort((a,b)=>b.t.base_revision-a.t.base_revision);
    for(const {t} of pending){
      for(const code of [...Object.keys(t.delta.customers),...(t.delta.customers_removed||[])]){
        const event=t.delta.history.find(e=>e.MA_KHACH===code);
        if(!event)C.fail('JOURNAL_CORRUPT');
        if(event.TRUOC)state.customers[code]=event.TRUOC;else delete state.customers[code];
      }
      state.revision=t.base_revision;
    }
    if(action==='history'){
      const hidden=new Set(pending.flatMap(x=>x.t.delta.history.map(e=>e.ID)));
      state.history=this.rows('LICH_SU').filter(r=>!hidden.has(r[0])).map(r=>Object.fromEntries(SCHEMA.LICH_SU.map((k,i)=>[k,['TRUOC','SAU'].includes(k)?JSON.parse(r[i]||'null'):r[i]])));
    }
    if(this.props.getProperty('CD_COMMIT_REVISION')!==fence){this.cache=new Map();this.validated=false;return this.readConsistent(action,payload);}
    return query(state,action,payload,this.hash);
  }
  allocate() {
    const a = this.props.getProperty("CD_COUNTER"), b = this.meta("COUNTER");
    if (a === null && b === null) C.fail("COUNTER_MISSING");
    if (a !== null && !/^\d+$/.test(a) || b !== null && !/^\d+$/.test(b)) C.fail("COUNTER_CORRUPT");
    const n = Math.max(Number(a || 0), Number(b || 0)), last = Math.max(0, ...this.rows("KHACH").map((r) => /^KTD-\d{6}$/.test(r[0]) ? Number(r[0].slice(4)) : 0));
    if (n < last) C.fail("COUNTER_REGRESSED");
    if (!Number.isSafeInteger(n) || n < 0 || n >= 999999) C.fail("COUNTER_EXHAUSTED");
    this.props.setProperty("CD_COUNTER", String(n + 1));
    this.setMeta("COUNTER", n + 1);
    this.flush();
    return "KTD-" + String(n + 1).padStart(6, "0");
  }
  read({light=false,mappings=false}={}) {
    if(!this.depth){this.cache=new Map();this.validated=false;this.validate();}
    const s = C.initial();
    s.revision = Number(this.meta("REVISION") || 0);
    for (const row of this.rows("KHACH")) {
      const c = Object.fromEntries(SCHEMA.KHACH.map((k, i) => [k, row[i]]));
      for (const k of ["DIEN_THOAI", "MA_CU"]) c[k] = c[k] ? c[k].split(/;\s*/) : [];
      c.NGUOI_LIEN_HE = JSON.parse(c.NGUOI_LIEN_HE || "[]");
      c.VERSION = Number(c.VERSION);
      c.HAN_MUC_NO = Number(c.HAN_MUC_NO || 0);
      c.CHO_PHEP_NO = c.CHO_PHEP_NO.toLowerCase() === "true";
      s.customers[c.MA_KHACH] = c;
    }
    if(light){if(mappings)for(const r of this.rows('ANH_XA'))s.mappings[r[0]]=r[3];return s;}
    for (const r of this.rows("NGUON")) s.sources[r[0]] = JSON.parse(r[3]);
    for (const r of this.rows("DUYET_TRUNG")) s.reviews[r[0]] = JSON.parse(r[8]);
    for (const r of this.rows("ANH_XA")) s.mappings[r[0]] = r[3];
    for (const r of this.rows("LICH_SU")) {
      const e = Object.fromEntries(SCHEMA.LICH_SU.map((k, i) => [k, r[i]]));
      e.TRUOC = JSON.parse(e.TRUOC || "null");
      e.SAU = JSON.parse(e.SAU || "null");
      s.history.push(e);
    }
    return s;
  }
  transactions() { return this.decodeTransactions(this.rows("CD_JOURNAL")); }
  decodeTransactions(all) {
    const prepared = all.filter((r) => r[1] === "PREPARED"), out = [];
    for (const m of prepared) {
      const n = Number(m[3]);if(!Number.isSafeInteger(n)||n<1)C.fail('JOURNAL_CORRUPT');
      const parts = all.filter((r) => r[0] === m[0] && r[1] === "DATA").sort((a, b) => Number(a[2]) - Number(b[2]));
      if (parts.length !== n || parts.some((p, i) => Number(p[2]) !== i || p[4] !== m[4] || Number(p[3]) !== n)) C.fail("JOURNAL_CORRUPT");
      const raw = parts.map((r) => r[5]).join("");
      if (this.hash(raw) !== m[4]) C.fail("JOURNAL_CORRUPT");
      let t;try{t=JSON.parse(raw);}catch(error){C.fail('JOURNAL_CORRUPT');}
      if(t.id!==m[0] || !Number.isSafeInteger(t.base_revision) || !t.delta || t.delta.revision!==t.base_revision+1 || !Array.isArray(t.delta.history) || ['customers','sources','reviews','mappings'].some(k=>!t.delta[k]||typeof t.delta[k]!=='object'||Array.isArray(t.delta[k])) || t.history_start!==undefined&&(!Number.isSafeInteger(t.history_start)||t.history_start<2))C.fail('JOURNAL_CORRUPT');
      out.push({ t, committed: all.some((r) => r[0] === t.id && r[1] === "COMMITTED") });
    }
    return out.sort((a, b) => a.t.base_revision - b.t.base_revision);
  }
  receipt(key) {
    const rows = this.rows("CD_RECEIPTS"), found = rows.filter((r) => r[0] === key);
    if (found.length > 1) C.fail('JOURNAL_CONFLICT');
    if(this.legacyCommitRevision){const latest=Math.max(0,...rows.map(r=>Number(r[3]))),rev=this.values('CD_META').find(r=>r[0]==='REVISION');rev[1]=String(Math.max(Number(rev[1]),latest));}
    return found.length ? { hash: found[0][1], result: JSON.parse(found[0][2]) } : null;
  }
  prepare(t) {
    if (JSON.stringify(t.result).length > 4e4) C.fail("ROW_TOO_LARGE");
    const tables = rowsFor(t.delta);
    for (const rows of Object.values(tables)) for (const row of rows) for (const v of row) if (String(v).length > 4e4) C.fail("ROW_TOO_LARGE");
    t.history_start=this.table('LICH_SU').getLastRow()+1;
    const raw = JSON.stringify(t);
    if (raw.length > 8e6) C.fail("TRANSACTION_TOO_LARGE");
    const parts = [];
    for (let i = 0; i < raw.length; ) {
      let end = Math.min(i + 15e3, raw.length);
      if (end < raw.length && /[\uD800-\uDBFF]/.test(raw[end - 1])) end--;
      parts.push(raw.slice(i, end));
      i = end;
    }
    const digest = this.hash(raw), sheet = this.table("CD_JOURNAL");
    const first=sheet.getLastRow()+1;
    this.write("CD_JOURNAL", first, parts.map((p, i) => [t.id, "DATA", i, parts.length, digest, p]));
    this.flush();
    this.fault("chunks");
    this.write("CD_JOURNAL", sheet.getLastRow() + 1, [[t.id, "PREPARED", -1, parts.length, digest, ""]]);
    this.flush();
    const checked=sheet.getRange(first,1,parts.length+1,6).getDisplayValues();
    if(!this.decodeTransactions(checked).some(x=>x.t.id===t.id))C.fail('JOURNAL_CORRUPT');
    this.fault("prepared");
  }
  upsert(name, newRows, removed = []) {
    const sheet = this.table(name), entries=this.entries(name), rows=entries.map(x=>x.values), map=new Map(entries.map(x=>[x.values[0],x.row]));
    if (removed.length || name === "DUYET_TRUNG" && newRows.length) {
      const merged = new Map(rows.filter((r) => !removed.includes(r[0])).map((r) => [r[0], r]));
      for (const r of newRows) merged.set(r[0], r);
      const next2 = [...merged.values()];
      if (name === "DUYET_TRUNG") next2.sort((a, b) => Number(a[1] !== "Có") - Number(b[1] !== "Có") || a[0].localeCompare(b[0]));
      if (next2.length) this.write(name, 2, next2);
      if (rows.length > next2.length) this.clear(name,next2.length+2,rows.length-next2.length);
      return;
    }
    const writes = [];
    let next = sheet.getLastRow()+1;
    for (const row of newRows) {
      const i = map.has(row[0]) ? map.get(row[0]) : next++;
      writes.push({ i, row });
    }
    writes.sort((a, b) => a.i - b.i);
    for (let start = 0; start < writes.length; ) {
      let end = start + 1;
      while (end < writes.length && writes[end].i === writes[end - 1].i + 1) end++;
      this.write(name, writes[start].i, writes.slice(start, end).map((w) => w.row));
      start = end;
    }
  }
  apply(t) {
    const revision = Number(this.meta("REVISION") || 0);
    if (revision !== t.base_revision && revision !== t.delta.revision) C.fail("RECOVERY_CONFLICT");
    if (revision === t.delta.revision) return;
    const tables = rowsFor(t.delta), removed = { KHACH: t.delta.customers_removed, NGUON: t.delta.sources_removed, DUYET_TRUNG: t.delta.reviews_removed, ANH_XA: t.delta.mappings_removed };
    for (const [name, rows] of Object.entries(tables)) {
      if(name==='LICH_SU' && rows.length && t.history_start!==undefined)
        this.measure('history_append',()=>{
          if(this.table(name).getLastRow()>=t.history_start){
            const existing=this.table(name).getRange(t.history_start,1,rows.length,1).getDisplayValues();
            if(existing.some((r,i)=>r[0]&&r[0]!==rows[i][0]))C.fail('RECOVERY_CONFLICT');
          }
          this.write(name,t.history_start,rows);
        });
      else if(rows.length || (removed[name]||[]).length)this.upsert(name,rows,removed[name]||[]);
      this.fault(name);
    }
    if(Object.keys(t.delta.customers).length || t.delta.customers_removed?.length)this.measure('index_delta',()=>this.updateIndex(t));
    this.flush();
    this.fault("projections");
    this.setMeta("REVISION", t.delta.revision);
    this.flush();
    this.fault("applied");
  }
  commit(t) {
    const old = this.receipt(t.key);
    if (old && (old.hash !== t.hash || stable(old.result)!==stable(t.result))) C.fail("JOURNAL_CONFLICT");
    this.upsert("CD_RECEIPTS", [[t.key, t.hash, JSON.stringify(t.result), t.delta.revision]]);
    this.flush();
    const journal=this.table('CD_JOURNAL'), last=journal.getLastRow();
    // Normal prepare is at the tail; recovery's decoded cache tells us which
    // transactions already committed without reading the full log again.
    this.write('CD_JOURNAL',last+1,[[t.id,'COMMITTED',t.delta.revision,0,t.hash,'']]);
    this.flush();
    this.props.setProperty('CD_COMMIT_REVISION',String(t.delta.revision));
    this.fault("committed");
    this.measure('journal_prune',()=>this.pruneJournal(t.delta.revision));
  }
  updateIndex(t) {
    const affected=new Set([...Object.keys(t.delta.customers),...(t.delta.customers_removed||[])]);
    const desired=new Map();
    for(const c of Object.values(t.delta.customers)){
      const pairs=[['TEN',c.TEN],['MA',c.MA_KHACH],['DIA_CHI',c.DIA_CHI],['MST',c.MST],...c.DIEN_THOAI.map(p=>['SDT',p]),...c.NGUOI_LIEN_HE.flatMap(p=>p.dien_thoai.map(n=>['SDT',n])),...c.MA_CU.map(p=>['MA_CU',p])];
      for(const [kind,value] of pairs)if(value){const key=this.hash(c.MA_KHACH+'|'+kind+'|'+value);desired.set(key,[key,kind,value,C.fold(value),c.MA_KHACH]);}
    }
    const entries=this.entries('CHI_MUC'), occupied=new Set(entries.map(x=>x.row)), kept=new Set(), free=[];
    for(const x of entries)if(affected.has(x.values[4])){
      if(desired.has(x.values[0])&&!kept.has(x.values[0])){
        kept.add(x.values[0]);if(stable(x.values)!==stable(desired.get(x.values[0])))this.write('CHI_MUC',x.row,[desired.get(x.values[0])]);
      }else {this.clear('CHI_MUC',x.row,1);occupied.delete(x.row);this.fault('index_removed');}
    }
    const sheet=this.table('CHI_MUC'), last=sheet.getLastRow();
    for(let row=2;row<=last;row++)if(!occupied.has(row))free.push(row);
    let next=last+1;const writes=[];
    for(const [key,row] of desired)if(!kept.has(key))writes.push({at:free.length?free.shift():next++,row});
    writes.sort((a,b)=>a.at-b.at);
    for(let i=0;i<writes.length;){let end=i+1;while(end<writes.length&&writes[end].at===writes[end-1].at+1)end++;
      this.write('CHI_MUC',writes[i].at,writes.slice(i,end).map(x=>x.row));this.fault('index_written');i=end;}

  }
  pruneJournal(revision) {
    if(revision<=200)return;
    const sheet=this.table('CD_JOURNAL'), cutoff=revision-200;
    let scanned=0;const pending=new Set();
    while(sheet.getLastRow()>1+scanned){
      const count=Math.min(128,sheet.getLastRow()-1-scanned), head=sheet.getRange(2+scanned,1,count,4).getDisplayValues();
      if(head.some(r=>r[1]==='COMMITTED'&&Number(r[2])<0)){
        let legacy=this.legacyRevisions;
        if(!legacy){try{legacy=JSON.parse(this.meta('JOURNAL_LEGACY_REVISIONS')||'{}');}catch(error){C.fail('META_CORRUPT');}}
        if(head.some(r=>r[1]==='COMMITTED'&&Number(r[2])<0&&!Number.isSafeInteger(legacy[r[0]]))){
          const verified=this.transactions().filter(x=>x.committed);
          legacy=Object.fromEntries(verified.map(x=>[x.t.id,x.t.delta.revision]));
          const retained=Object.fromEntries(verified.filter(x=>x.t.delta.revision>cutoff).map(x=>[x.t.id,x.t.delta.revision]));
          if(JSON.stringify(retained).length>40000)C.fail('ROW_TOO_LARGE');
          this.setMeta('JOURNAL_LEGACY_REVISIONS',JSON.stringify(retained));this.flush();
        }
        this.legacyRevisions=legacy;
        for(const r of head)if(r[1]==='COMMITTED'&&Number(r[2])<0)r[2]=String(legacy[r[0]]);
      }
      let end=-1,stop=false;
      for(let i=0;i<head.length;i++){
        const r=head[i];if(r[1]==='PREPARED')pending.add(r[0]);
        if(r[1]==='COMMITTED'){
          if(!Number.isSafeInteger(Number(r[2]))||Number(r[2])<1)C.fail('JOURNAL_CORRUPT');
          pending.delete(r[0]);
          if(Number(r[2])>cutoff){stop=true;break;}
          if(pending.size)C.fail('JOURNAL_CORRUPT');
          end=i;
        }
      }
      if(end>=0){
        sheet.deleteRows(2,scanned+end+1);this.cache.delete('CD_JOURNAL');this.flush();this.fault('journal_pruned');
        scanned=0;pending.clear();if(stop)return;
      }else {if(stop)return;scanned+=head.length;}
    }
  }

  recover() {
    this.validate();
    const sheet = this.table("CD_JOURNAL"), last=sheet.getLastRow();
    if(last>1){
      const tail=sheet.getRange(last,1,1,6).getDisplayValues()[0];
      if(tail[1]==='COMMITTED'){
        if(Number(tail[2])>=0){const row=this.values('CD_META').find(r=>r[0]==='REVISION');if(Number(row[1])>Number(tail[2]))C.fail('RECOVERY_CONFLICT');row[1]=String(tail[2]);}else this.legacyCommitRevision=true;
        return;
      }
    }
    for (const x of this.transactions()) if (!x.committed) {
      this.apply(x.t);
      this.commit(x.t);
    }
  }
  customerMap() {
    return new Map(this.rows("KHACH").map(values => {
      const c = Object.fromEntries(SCHEMA.KHACH.map((k,i) => [k, values[i]]));
      for (const k of ["DIEN_THOAI", "MA_CU"]) c[k] = c[k] ? c[k].split(/;\s*/) : [];
      c.NGUOI_LIEN_HE = JSON.parse(c.NGUOI_LIEN_HE || "[]");
      c.VERSION = Number(c.VERSION); c.HAN_MUC_NO = Number(c.HAN_MUC_NO || 0);
      c.CHO_PHEP_NO = c.CHO_PHEP_NO.toLowerCase() === "true";
      return [c.MA_KHACH, c];
    }));
  }
  resolved(ma, customers) {
    const seen = new Set(); let c = customers.get(ma);
    if (!c) C.fail("NOT_FOUND");
    while (c.TRANG_THAI === "DA_GOP") {
      if (seen.has(c.MA_KHACH)) C.fail("MERGE_CYCLE");
      seen.add(c.MA_KHACH); c = customers.get(c.GOP_VAO);
      if (!c) C.fail("NOT_FOUND");
    }
    return c;
  }
  query(action, p = {}) {
    const customers = ["search", "get", "history"].includes(action) ? this.customerMap() : null;
    if (action === "overview") return { revision: Number(this.meta("REVISION") || 0), customers: Math.max(0, this.table("KHACH").getLastRow() - 1) };
    if (action === "get") {
      let ma = p.ma;
      if (!/^KTD-\d{6}$/.test(ma)) {
        const alias = this.rows("CHI_MUC").find((r) => r[1] === "MA_CU" && r[2] === ma);
        if (!alias) C.fail("NOT_FOUND");
        ma = alias[4];
      }
      return { customer: this.resolved(ma, customers) };
    }
    if (action === "search") {
      const q = C.fold(p.q), phone = String(p.q || "").replace(/[ () .-]/g, "").replace(/^\+84/, "0").replace(/^0084/, "0").replace(/\D/g, ""), numeric = phone && !/[a-z]/.test(q), out = [], seen = /* @__PURE__ */ new Set();
      for (const row of this.rows("CHI_MUC")) {
        if (!q && row[1] === "MA" || q && (row[3].includes(q) || numeric && ["SDT", "MST"].includes(row[1]) && row[2].includes(phone))) {
          const c = this.resolved(row[4], customers);
          if (!seen.has(c.MA_KHACH)) {
            out.push(c);
            seen.add(c.MA_KHACH);
          }
          if (out.length === 20) break;
        }
      }
      return { customers: out };
    }
    if (action === "history") {
      let ma = p.ma;
      if (!customers.has(ma)) ma = this.rows("CHI_MUC").find(r => r[1] === "MA_CU" && r[2] === ma)?.[4];
      const c = this.resolved(ma, customers);
      return { events: this.rows("LICH_SU").filter((r) => [c.MA_KHACH, p.ma, ...c.MA_CU.filter((k) => /^KTD-\d{6}$/.test(k))].includes(r[2])).slice(-100).reverse().map((r) => Object.fromEntries(SCHEMA.LICH_SU.map((k, i) => [k, ["TRUOC", "SAU"].includes(k) ? JSON.parse(r[i] || "null") : r[i]]))) };
    }
    return query(this.read(), action, p, this.hash);
  }
}
module.exports = { SheetsDriver, SCHEMA, ORIGINAL_IDS, rowsFor };
