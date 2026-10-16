'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),vm=require('node:vm'),{createClient}=require('../customer-directory.cjs'),{fixture}=require('./directory-fixture.cjs');
const actor={id:'dispatch',roles:['dispatcher']};
function client(send,clock){return createClient({config:()=>({url:'https://example.test',secret:'fixture-only',actors:{dispatch:{role:'dispatcher',actor_id:'directory-user'}}}),send,clock,hmac:()=> 'fixture-signature',id:()=>crypto.randomUUID()});}
test('directory sends explicit 8s deadline, rejects a late successful result as unavailable',()=>{let tick=100;const c=client((url,envelope,limits)=>{assert.equal(limits.timeoutMs,8000);assert.equal(limits.deadline,8100);tick=8101;return {ok:true,data:{customer:{}}};},()=>tick);assert.throws(()=>c.call(actor,'create',{}, {idempotency_key:'same'}),/DIRECTORY_UNAVAILABLE/);});
test('directory native timeout becomes DIRECTORY_UNAVAILABLE without leaking transport contents',()=>{const c=client(()=>{throw Error('Request timed out');},()=>0);assert.throws(()=>c.call(actor,'get',{ma:'KTD-000001'}),e=>e.code==='DIRECTORY_UNAVAILABLE');});
test('late remote create committed then retry with same key returns same customer, no duplicate',()=>{const f=fixture();let tick=0,slow=true;const payload={customer:{TEN:'TEST_DEADLINE',LOAI:'CA_NHAN'}};
 const c=client((url,envelope)=>{const result=f.client.call(actor,envelope.action,envelope.payload,{idempotency_key:envelope.idempotency_key});if(slow){tick+=9000;slow=false;}return {ok:true,data:result};},()=>tick);
 assert.throws(()=>c.call(actor,'create',payload,{idempotency_key:'same-key'}),/DIRECTORY_UNAVAILABLE/);const r=c.call(actor,'create',payload,{idempotency_key:'same-key'});assert(r.replayed);assert.equal(Object.keys(f.driver.state.customers).length,1);
});
test('GAS deadline checked before/after each redirect hop; no unsupported UrlFetch timeout option',()=>{
 const source=fs.readFileSync(require.resolve('../customer-directory.gs.txt'),'utf8');let tick=0,calls=0;const box={Date:{now:()=>tick},UrlFetchApp:{fetch:()=>{calls++;tick+=9000;return {getResponseCode:()=>302,getAllHeaders:()=>({Location:'https://script.googleusercontent.com/macros/echo?fixture'})};}}};vm.createContext(box);vm.runInContext(source,box);
 assert.throws(()=>box.dispatchDirectoryFetch_('url',{}, {},{setProperty(){}},'diag',8000),/DIRECTORY_UNAVAILABLE/);assert.equal(calls,1);
 assert(!/timeout\s*:/.test(source));
});
