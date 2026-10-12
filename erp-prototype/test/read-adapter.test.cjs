'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {TABLES,createReader}=require('../read-adapter.cjs');const evidence=require('../schema-evidence.json');
function fixture(key,{headers,rows=[],throwRead=false}={}){
 const d=TABLES[key],h=headers||evidence.headers.find(x=>x.source===d.source&&x.tab===d.tab).headers;
 const calls=[];let writes=0;
 const sheet={getLastRow:()=>d.headerRow+rows.length,getRange:(r,c,n,w)=>{
  calls.push({r,c,n,w});if(throwRead)throw Error('secret source error');
  return {getDisplayValues:()=>[h.slice(c-1,c-1+w)],getValues:()=>rows.slice(r-d.headerRow-1,r-d.headerRow-1+n).map(row=>row.slice(c-1,c-1+w)),setValues:()=>{writes++;throw Error('write forbidden');},setValue:()=>{writes++;throw Error('write forbidden');}};
 },appendRow:()=>{writes++;throw Error('write forbidden');}};
 const read=createReader({registry:{[d.source]:'configured-server-id'},openById:id=>{assert.equal(id,'configured-server-id');return {getSheetByName:tab=>{assert.equal(tab,d.tab);return sheet;}}},now:()=> '2026-10-12T03:00:00Z'});
 return {read,calls,writes:()=>writes,h};
}
for(const key of Object.keys(TABLES))test('header contract and zero writes: '+key,()=>{
 const d=TABLES[key],headers=evidence.headers.find(x=>x.source===d.source&&x.tab===d.tab).headers;
 const row=headers.map(()=> '');for(const [field,h] of Object.entries(d.fields))row[headers.indexOf(h)]=field==='qty'?5:field==='phone'?'0888304668':field;
 const f=fixture(key,{rows:[row]});const r=f.read(key);assert.equal(r.source_health,'AVAILABLE');assert.equal(r.data.length,1);assert.equal(f.writes(),0);assert.equal(r.next_offset,null);
});
test('employee adapters never read secret cell columns',()=>{
 for(const key of ['care_employees','finance_employees']){
  const d=TABLES[key],headers=evidence.headers.find(x=>x.source===d.source&&x.tab===d.tab).headers;
  const f=fixture(key,{rows:[headers.map(()=> 'synthetic')]});f.read(key);
  const sensitive=headers.flatMap((h,i)=>/mật khẩu|muối|MAT_KHAU|SALT|DANG_NHAP|Tên đăng nhập|Phiên bản|Đăng nhập|KHOA_DEN|BUOC_DOI/i.test(h)?[i+1]:[]);
  for(const call of f.calls.filter(c=>c.r>d.headerRow))assert(!sensitive.some(c=>c>=call.c&&c<call.c+call.w));
 }
});
test('missing/duplicate header fails closed',()=>{for(const h of [['bad'],Array(11).fill('Mã hàng')])assert.equal(fixture('kho58',{headers:h}).read('kho58').issues[0].code,'SCHEMA_MISMATCH');});
test('source read failure returns no partial values and sanitized error',()=>{const r=fixture('kho58',{throwRead:true}).read('kho58');assert.equal(r.source_health,'UNAVAILABLE');assert.deepEqual(r.data,[]);assert(!JSON.stringify(r).includes('secret'));});
test('pagination bounded and does not fabricate zero',()=>{const f=fixture('kho58',{rows:Array.from({length:3},()=>[1,'SKU','name','Hộp',2])});assert.equal(f.read('kho58',{limit:2}).next_offset,2);assert.equal(f.read('kho58',{offset:2,limit:2}).data.length,1);assert.throws(()=>f.read('kho58',{limit:101}),/INVALID_PAGE/);const invalid=fixture('kho58',{rows:[[1,'SKU','n','Hộp','oops']]}).read('kho58');assert.equal(invalid.issues[0].code,'INVALID_QUANTITY');assert.deepEqual(invalid.data,[]);});
test('Kho 145 missing master code remains unresolved',()=>{const r=fixture('kho145',{rows:[[1,'legacy','Hộp',0,0,2,'','']]}).read('kho145');assert.equal(r.issues[0].code,'UNMAPPED_PRODUCT');assert(!('source_key' in r.data[0]));});
test('server registry is copied and missing config fails closed',()=>{const registry={KHO58:'first'};let seen;const read=createReader({registry,openById:id=>{seen=id;throw Error();}});registry.KHO58='client';read('kho58');assert.equal(seen,'first');assert.equal(read('sale_products').issues[0].code,'SOURCE_NOT_CONFIGURED');});
