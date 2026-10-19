const {test}=require('node:test');const assert=require('node:assert/strict');const {resolveProduct}=require('../product-mapping.cjs');
const products={p1:{active:true,approved:true},p2:{active:true,approved:true}};
const key={source:'SALE',entity:'SAN_PHAM',source_key:'TD-0001'};
test('same code in separate sources remains distinct',()=>{const mappings=[{...key,product_id:'p1',approved:true},{source:'KHO58',entity:'TONKHO',source_key:'TD-0001',product_id:'p2',approved:true}];assert.equal(resolveProduct(key,mappings,products).product_id,'p1');assert.equal(resolveProduct({...key,source:'KHO58',entity:'TONKHO'},mappings,products).product_id,'p2');});
test('ambiguous mapping quarantines even when duplicate points to same ID',()=>{const m={...key,product_id:'p1',approved:true};assert.equal(resolveProduct(key,[m,m],products).status,'CONFLICT');});
test('missing key or approval never falls back to similar name',()=>{assert.equal(resolveProduct({...key,source_key:'',name:'same'},[],products).status,'UNMAPPED');assert.equal(resolveProduct(key,[{...key,product_id:'p1',approved:false}],products).status,'UNAPPROVED');});
