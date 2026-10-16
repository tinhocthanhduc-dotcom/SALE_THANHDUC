'use strict';
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createApp}=require('../server.cjs');const {passwordHash}=require('../auth.cjs');
let app,base,dir;
before(async()=>{dir=fs.mkdtempSync(path.join(os.tmpdir(),'dispatch-http-'));app=createApp(dir);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port;});
after(async()=>{await new Promise(r=>app.server.close(r));fs.rmSync(dir,{recursive:true,force:true});});
async function api(body,cookie='',origin){const r=await fetch(base+'/api',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});return {status:r.status,cookie:r.headers.get('set-cookie')?.split(';')[0],value:await r.json()};}
async function login(username){return api({action:'login',username,password:'DemoThanhDuc2026!'});}
test('PBKDF2 implementation matches Node crypto including unicode passwords',()=>{const salt='ab'.repeat(16),password='MậtKhẩu-😀-123456';assert.equal(passwordHash(password,salt),crypto.pbkdf2Sync(password,Buffer.from(salt,'hex'),600000,32,'sha256').toString('hex'));});
test('unauthenticated and cross-origin commands are denied',async()=>{assert.equal((await api({action:'query'})).status,401);assert.equal((await api({action:'login',username:'dispatch',password:'DemoThanhDuc2026!'},'','https://untrusted.example')).status,403);});
test('server sessions never leak tokens or password hashes in query projections',async()=>{const a=await login('dispatch');assert.equal(a.status,200);assert(a.cookie);assert.equal(a.value.token,undefined);const projection=await api({action:'query'},a.cookie);assert.equal(projection.status,200);assert.equal(JSON.stringify(projection.value).includes('password_hash'),false);assert.equal(JSON.stringify(projection.value).includes('salt'),false);await api({action:'logout'},a.cookie);assert.equal((await api({action:'query'},a.cookie)).status,401);});
test('five failures impose short backoff; correct login after waiting and disabling revokes sessions',async()=>{const originalNow=app.auth.now;let clock=Date.now();app.auth.now=()=>clock;for(let i=0;i<5;i++)assert.equal((await api({action:'login',username:'tech2',password:'WrongPassword123!'})).status,401);assert.equal((await login('tech2')).status,429);clock+=1001;const a=await login('tech2');assert.equal(a.status,200);const state=app.store.read();state.users.tech2.active=false;app.store.write(state);assert.equal((await api({action:'query'},a.cookie)).status,401);state.users.tech2.active=true;state.users.tech2.version++;app.store.write(state);assert.equal((await api({action:'query'},a.cookie)).status,401);app.auth.now=originalNow;});
test('wrong technician and forged role cannot access order or upload photos',async()=>{const a=await login('dispatch'),b=await login('tech1');let seq=0;const command=async(type,payload,version)=>api({action:'command',command:{type,payload,expected_version:version,idempotency_key:'http-'+(++seq)}},a.cookie);const customer=(await command('create_customer',{name:'Mẫu HTTP',phone:'0900123456',address:'Địa chỉ giả',area:'Tuyến giả'})).value.id;const machine=(await command('create_machine',{customer_id:customer,model:'Máy giả'})).value.id;const order=(await command('create_order',{customer_id:customer,machine_id:machine,address:'Địa chỉ giả',request:'Lỗi giả',source:'hotline',priority:'normal',appointment_time_start:'10:00',appointment_time_end:'11:00'})).value;
 assert.equal((await api({action:'query',order_id:order.order_id},b.cookie)).status,403);
 assert.equal((await api({action:'command',actor:{roles:['director']},command:{type:'assign',idempotency_key:'spoof',expected_version:order.version,payload:{order_id:order.order_id,technician_id:'tech1'}}},b.cookie)).status,403);
 assert.equal((await api({action:'upload',payload:{order_id:order.order_id,kind:'after',mime:'image/jpeg',base64:'AAAA',idempotency_key:'fake'}},b.cookie)).status,403);
});
test('local recovery preserves service customers without creating duplicates',()=>{const before=app.business.snapshot().state;const reopened=require('../../erp-prototype/local-repository.cjs').LocalRepository;const repo=new reopened(path.join(dir,'business'),{domain:require('../domain.cjs')});assert.deepEqual(repo.snapshot().state,before);});

test('session expiry requires login again',()=>{const session=app.auth.login('tech1','DemoThanhDuc2026!');const original=app.auth.now;app.auth.now=()=>session.expires_at+1;assert.throws(()=>app.auth.actor(session.token),/AUTH_REQUIRED/);app.auth.now=original;});
test('prepared image command recovery retains its owned evidence file',()=>{
 const dispatch=app.auth.login('dispatch','DemoThanhDuc2026!').token,tech=app.auth.login('tech1','DemoThanhDuc2026!').token;let sequence=0;
 const run=(type,payload,token=dispatch)=>app.service.command(token,{type,payload,idempotency_key:'recovery-image-'+(++sequence),expected_version:payload.order_id?app.business.snapshot().state.orders[payload.order_id].version:undefined});
 const customer=run('create_customer',{name:'Recovery fixture',phone:'0901234001',address:'Địa chỉ giả',area:'Tuyến giả'}).id;
 const machine=run('create_machine',{customer_id:customer,model:'Máy giả'}).id;
 const order=run('create_order',{customer_id:customer,machine_id:machine,address:'Địa chỉ giả',request:'Lỗi giả',source:'hotline',priority:'normal',appointment_time_start:'10:00',appointment_time_end:'11:00'}).order_id;
 run('assign',{order_id:order,technician_id:'tech1'});run('accept',{order_id:order},tech);run('schedule',{order_id:order,time_start:'10:00',time_end:'11:00',customer_confirmation:'Đồng ý'},tech);run('start',{order_id:order},tech);
 const bytes=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
 const payload={order_id:order,expected_version:app.business.snapshot().state.orders[order].version,idempotency_key:'photo-recovery',kind:'after',mime:'image/png',base64:bytes.toString('base64')};
 app.business.fault=point=>{if(point==='after_prepare')throw Error('CRASH');};
 assert.throws(()=>app.service.upload(tech,payload),/CRASH/);app.business.fault=()=>{};
 const receipt=app.service.upload(tech,payload);assert.equal(receipt.replayed,true);
 const evidence=app.business.snapshot().state.orders[order].evidence[0];assert.deepEqual(app.service.image(tech,order,evidence.id).data,bytes);
 assert.throws(()=>app.service.upload(tech,{...payload,base64:Buffer.from([...bytes,0]).toString('base64')}),/IDEMPOTENCY_CONFLICT/);
});

test('HTTP resume rotates to HttpOnly cookie without leaking token and rejects replay',async()=>{
 const session=app.auth.login('tech1','DemoThanhDuc2026!');
 assert.equal((await api({action:'resume',resume_code:session.resume_code},'','https://untrusted.example')).status,403);
 const result=await api({action:'resume',resume_code:session.resume_code});assert.equal(result.status,200);assert(result.cookie);assert.equal(result.value.actor.id,'tech1');assert.equal(result.value.expires_at,session.expires_at);assert.equal(result.value.token,undefined);assert.equal(result.value.resume_code,undefined);assert.throws(()=>app.auth.actor(session.token),/AUTH_REQUIRED/);
 assert.equal((await api({action:'resume',resume_code:session.resume_code})).status,401);assert.equal((await api({action:'query'},result.cookie)).status,200);await api({action:'logout'},result.cookie);assert.equal((await api({action:'query'},result.cookie)).status,401);
});
