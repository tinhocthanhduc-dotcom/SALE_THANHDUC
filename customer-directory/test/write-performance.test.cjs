'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{fixture,sheetDriver,actors,hash}=require('./helpers.cjs'),{SheetsDriver}=require('../sheets.cjs'),{populated,meter,request}=require('./performance-helpers.cjs');
test('realistic 200/1770/824 create: <=8 Sheets reads, one CD_META, zero import/history reads',()=>{
 const raw=populated(),stats=meter(raw),f=request(raw),c=f.create({TEN:'TEST_NEW',DIEN_THOAI:'0987654321',DIA_CHI:'TEST_NEW_ADDRESS'},'dispatcher');
 assert.equal(c.MA_KHACH,'KTD-000201');assert(stats.reads<=8,JSON.stringify(stats));assert.equal(stats.tables.CD_META,1);
 for(const name of ['NGUON','DUYET_TRUNG','LICH_SU','ANH_XA'])assert.equal(stats.tables[name]||0,0,name);
 assert.equal(stats.tables.KHACH,1);assert.equal(stats.tables.CHI_MUC,1);assert(stats.writes.filter(w=>w.table==='CHI_MUC').reduce((n,w)=>n+w.rows.length,0)<=4);
});
for(const type of ['update','add_contact'])test(type+' skips import/history and updates only this customer index',()=>{
 const raw=populated(),f=request(raw),c=f.create({TEN:'TEST_COMPANY',LOAI:'CONG_TY',DIEN_THOAI:'0987654321'}),other=raw.sheets.CHI_MUC.rows.filter(r=>r[4]&&r[4]!==c.MA_KHACH).map(r=>[...r]);
 const stats=meter(raw),g=request(raw);
 g.submit(type,type==='update'?{ma:c.MA_KHACH,customer:{DIA_CHI:'TEST_CHANGED',DIEN_THOAI:'0976543210'}}:{ma:c.MA_KHACH,contact:{ten:'TEST_CONTACT',dien_thoai:'0965432109'}},'finance',1,'perf-'+type);
 for(const name of ['NGUON','DUYET_TRUNG','LICH_SU','ANH_XA'])assert.equal(stats.tables[name]||0,0,name);
 assert.equal(stats.tables.CD_META,1);assert.deepEqual(raw.sheets.CHI_MUC.rows.filter(r=>r[4]&&r[4]!==c.MA_KHACH),other);
 const q=type==='update'?'0976543210':'0965432109';assert.equal(g.repo.read('search',{q},actors.sales).customers[0].MA_KHACH,c.MA_KHACH);
 if(type==='update')assert.equal(g.repo.read('search',{q:'0987654321'},actors.sales).customers.length,0);
});
for(const stage of ['index_removed','index_written'])test('recovery after '+stage+' repairs only changed indexes and keeps one history event',()=>{
 const raw=sheetDriver(),f=fixture(raw.driver),c=f.create({TEN:'TEST_BEFORE',DIEN_THOAI:'0987654321'});let once=true;
 raw.driver.fault=at=>{if(at===stage&&once){once=false;throw Error('INDEX_INTERRUPTED');}};
 const cmd={type:'update',payload:{ma:c.MA_KHACH,customer:{TEN:'TEST_AFTER',DIEN_THOAI:'0976543210'}},expected_version:1,idempotency_key:'same-update'};
 assert.throws(()=>f.repo.submit(cmd,actors.finance),/INDEX_INTERRUPTED/);f.repo.submit(cmd,actors.finance);
 assert.equal(f.repo.read('search',{q:'0987654321'},actors.sales).customers.length,0);assert.equal(f.repo.read('search',{q:'0976543210'},actors.sales).customers.length,1);
 assert.equal(raw.sheets.LICH_SU.getLastRow(),3);const ids=raw.sheets.CHI_MUC.rows.slice(1).filter(r=>r[0]).map(r=>r[0]);assert.equal(new Set(ids).size,ids.length);
});
test('history appends preserve old rows; retry after interrupted append does not append again',()=>{
 const raw=populated(),f=request(raw),before=raw.sheets.LICH_SU.rows.map(r=>[...r]);let once=true;
 f.driver.fault=at=>{if(at==='LICH_SU'&&once){once=false;throw Error('HISTORY_INTERRUPTED');}};
 const command={type:'create',payload:{customer:{TEN:'TEST_HISTORY'}},idempotency_key:'history-retry'};
 assert.throws(()=>f.repo.submit(command,actors.finance),/HISTORY_INTERRUPTED/);f.repo.submit(command,actors.finance);
 assert.deepEqual(raw.sheets.LICH_SU.rows.slice(0,before.length),before);assert.equal(raw.sheets.LICH_SU.getLastRow(),before.length+1);
});
test('journal keeps last 200 revisions, old receipt replay works and concurrent readers still see committed values',()=>{
 let during=null,f;const raw=sheetDriver();f=fixture(raw.driver);let first;
 for(let i=0;i<230;i++){const c=f.create({TEN:'TEST_PRUNE_'+i});if(!i)first=c;}
 assert.equal(raw.driver.transactions().length,200);assert.equal(raw.driver.transactions()[0].t.delta.revision,31);
 const old=f.submit('create',{customer:{TEN:'TEST_PRUNE_0',LOAI:'CA_NHAN'}},'finance',undefined,'test-0');assert(old.replayed);assert.equal(old.customer.MA_KHACH,first.MA_KHACH);
 raw.driver.fault=at=>{if(at==='KHACH')during=f.repo.read('get',{ma:first.MA_KHACH},actors.sales).customer.TEN;};
 f.submit('update',{ma:first.MA_KHACH,customer:{TEN:'TEST_CHANGED'}},'finance',1);
 assert.equal(during,'TEST_PRUNE_0');assert.equal(f.repo.read('get',{ma:first.MA_KHACH},actors.sales).customer.TEN,'TEST_CHANGED');
});
test('crash just after journal prune retains idempotency/history and never recovers deleted prefix',()=>{
 const raw=sheetDriver(),f=fixture(raw.driver);for(let i=0;i<200;i++)f.create({TEN:'TEST_'+i});let once=true;
 raw.driver.fault=at=>{if(at==='journal_pruned'&&once){once=false;throw Error('PRUNE_INTERRUPTED');}};
 const cmd={type:'create',payload:{customer:{TEN:'TEST_PRUNE_RETRY'}},idempotency_key:'prune-retry'};
 assert.throws(()=>f.repo.submit(cmd,actors.finance),/PRUNE_INTERRUPTED/);assert(f.repo.submit(cmd,actors.finance).replayed);
 assert.equal(raw.sheets.KHACH.getLastRow(),202);assert.equal(raw.sheets.LICH_SU.getLastRow(),202);assert.equal(raw.driver.transactions().length,200);
});
test('prepared journal corrupted hash fails closed, does not advance state or create receipt',()=>{
 const raw=sheetDriver(),f=fixture(raw.driver);let once=true;raw.driver.fault=at=>{if(at==='prepared'&&once){once=false;throw Error('INTERRUPTED');}};
 const cmd={type:'create',payload:{customer:{TEN:'TEST_CORRUPT'}},idempotency_key:'bad'};assert.throws(()=>f.repo.submit(cmd,actors.finance));
 const chunk=raw.sheets.CD_JOURNAL.rows.find(r=>r[1]==='DATA');chunk[5]+='corrupt';
 assert.throws(()=>f.repo.submit(cmd,actors.finance),/JOURNAL_CORRUPT/);assert.equal(raw.sheets.KHACH.getLastRow(),1);assert.equal(raw.sheets.CD_RECEIPTS.getLastRow(),1);
});
test('driver constructed before another writer uses fresh committed revision inside lock and one metadata read',()=>{
 const raw=sheetDriver(),waiting=new SheetsDriver(raw.options),first=fixture(raw.driver);first.create({TEN:'TEST_FIRST'});
 const second=fixture(waiting).submit('create',{customer:{TEN:'TEST_SECOND'}},'finance',undefined,'second').customer;assert.equal(second.MA_KHACH,'KTD-000002');assert.equal(raw.sheets.CD_META.rows.find(r=>r[0]==='REVISION')[1],'2');
});
test('legacy commit markers are upgraded and pruned without changing materialized history',()=>{
 const raw=sheetDriver(),f=fixture(raw.driver);for(let i=0;i<200;i++)f.create({TEN:'TEST_LEGACY_'+i});
 for(const row of raw.sheets.CD_JOURNAL.rows)if(row[1]==='COMMITTED')row[2]='-1';const history=raw.sheets.LICH_SU.rows.map(r=>[...r]);
 f.create({TEN:'TEST_NEW_FORMAT'});assert.equal(raw.driver.transactions().length,200);assert.deepEqual(raw.sheets.LICH_SU.rows.slice(0,history.length),history);
});
test('pruning create with 220 real journal/receipt rows still uses at most 8 data reads and one CD_META',()=>{
 const raw=sheetDriver(),f=fixture(raw.driver);for(let i=0;i<220;i++)f.create({TEN:'TEST_BUDGET_'+i});
 const stats=meter(raw),g=request(raw);g.submit('create',{customer:{TEN:'TEST_BUDGET_NEW'}},'dispatcher',undefined,'budget-new');
 assert(stats.reads<=8,JSON.stringify(stats));assert.equal(stats.tables.CD_META,1);for(const name of ['NGUON','DUYET_TRUNG','LICH_SU'])assert.equal(stats.tables[name]||0,0,name);
});
