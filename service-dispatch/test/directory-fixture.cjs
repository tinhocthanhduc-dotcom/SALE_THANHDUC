'use strict';
const crypto=require('node:crypto'),{Repository,MemoryDriver}=require('../../customer-directory/repository.cjs'),C=require('../../customer-directory/core.cjs'),A=require('../../customer-directory/auth.cjs'),S=require('../../customer-directory/service.cjs'),{createClient}=require('../customer-directory.cjs');
function fixture(){
 let timestamp=Date.parse('2026-10-15T09:00:00Z'),offline=false,wrong=false,calls=[];const users={dispatch:{id:'dispatch@directory.test',name:'Tiếp nhận thử',roles:['dispatcher']},director:{id:'director@directory.test',name:'Giám đốc thử',roles:['director']},tech1:{id:'tech1@directory.test',name:'Thợ thử',roles:['dispatcher']}};
 const actors=Object.fromEntries(Object.keys(users).map(id=>[id,{actor_id:users[id].id,role:id==='director'?'director':'dispatcher'}]));
 const driver=new MemoryDriver(),repo=new Repository(driver,{hash:s=>crypto.createHash('sha256').update(s).digest('hex'),now:()=>new Date(timestamp).toISOString(),id:()=>crypto.randomUUID()});
 const hmac=(s,key)=>crypto.createHmac('sha256',key).update(s).digest('hex'),clients={DIEUPHOI:{active:true,secret:'fixture-only-never-real',actors:Object.values(users).map(u=>u.id)}};
 const client=createClient({config:()=>({url:'https://example.test/directory-copy',secret:wrong?'wrong':clients.DIEUPHOI.secret,actors}),now:()=>timestamp,id:()=>crypto.randomUUID(),hmac,send:(url,envelope)=>{calls.push({...envelope,signature:'REDACTED'});if(offline)throw Error('fixture network unavailable');return S.response(()=>S.handle(envelope,A.authenticate(envelope,{clients,users:Object.fromEntries(Object.values(users).map(u=>[u.id,u])),hmac,now:()=>timestamp}),repo));}});
 const command=(type,payload,expected_version,who='director')=>repo.submit({type,payload,expected_version,idempotency_key:crypto.randomUUID()},users[who]);
 const create=(customer={})=>command('create',{customer:{TEN:'TEST',LOAI:'CA_NHAN',DIEN_THOAI:['0909123456'],DIA_CHI:'Địa chỉ mẫu',...customer}}).customer;
 return {client,repo,driver,users,actors,calls,command,create,now:()=>new Date(timestamp).toISOString(),advance:ms=>timestamp+=ms,setOffline:v=>offline=v,setWrong:v=>wrong=v};
}
module.exports={fixture};
