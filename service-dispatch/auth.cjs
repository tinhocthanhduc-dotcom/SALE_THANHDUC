'use strict';
const {pbkdf2}=require('@noble/hashes/pbkdf2');
const {sha256}=require('@noble/hashes/sha256');
const {bytesToHex,hexToBytes}=require('@noble/hashes/utils');
function fail(code){const e=new Error(code);e.code=code;throw e;}
function utf8(text){const out=[];for(const char of text){let n=char.codePointAt(0);if(n>=0xd800&&n<=0xdfff)n=0xfffd;if(n<128)out.push(n);else if(n<2048)out.push(192|(n>>6),128|(n&63));else if(n<65536)out.push(224|(n>>12),128|((n>>6)&63),128|(n&63));else out.push(240|(n>>18),128|((n>>12)&63),128|((n>>6)&63),128|(n&63));}return Uint8Array.from(out);}
function digest(text){return bytesToHex(sha256(utf8(text)));}
function passwordHash(password,salt,iterations=600000){return bytesToHex(pbkdf2(sha256,utf8(password),hexToBytes(salt),{c:iterations,dkLen:32}));}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;let result=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)result|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return result===0;}
function createUser({id,username,name,roles,password,random,iterations=600000}){
 if(!id||typeof username!=='string'||!/^[a-z0-9_.-]{3,60}$/i.test(username)||!name||!Array.isArray(roles)||!roles.length||roles.some(r=>!['dispatcher','technician','director','warehouse','finance'].includes(r)))fail('INVALID_USER');
 if(typeof password!=='string'||password.length<12||password.length>128)fail('WEAK_PASSWORD');
 if(!Number.isSafeInteger(iterations)||iterations<1||iterations>2000000)fail('INVALID_HASH_POLICY');
 const salt=random();return {id,username:username.toLowerCase(),name,roles,active:true,version:1,scheme:'pbkdf2-sha256',iterations,salt,password_hash:passwordHash(password,salt,iterations),failed:0,locked_until:0};
}
class Auth {
 constructor({store,random,now=()=>Date.now(),sessionMs=8*3600000,maxAttempts=5,globalAttempts=20,rateWindowMs=15*60000,passwordIterations=600000,hash=passwordHash,onHashTiming=()=>{},maxConcurrent=2}){
  if(!Number.isSafeInteger(passwordIterations)||passwordIterations<1||passwordIterations>2000000)fail('INVALID_HASH_POLICY');
  Object.assign(this,{store,random,now,sessionMs,maxAttempts,globalAttempts,rateWindowMs,passwordIterations,hash,onHashTiming,maxConcurrent});
 }
 rate_(state,at){
  const rate=state.login_rate||{global:{},accounts:{},leases:{},recent:[]};
  rate.accounts=rate.accounts||{};rate.leases=rate.leases||{};rate.recent=rate.recent||[];
  const fresh=b=>!b||at-(b.last_failure||0)>this.rateWindowMs?{failures:0,next_at:0}:b;
  rate.global=fresh(rate.global);
  for(const [key,b] of Object.entries(rate.accounts))if(at-(b.last_failure||0)>this.rateWindowMs)delete rate.accounts[key];
  for(const [key,until] of Object.entries(rate.leases))if(until<=at)delete rate.leases[key];
  state.login_rate=rate;return rate;
 }
 audit_(rate,username,at){rate.recent.push({at:new Date(at).toISOString(),username:username.replace(/[\u0000-\u001f\u007f]/g,'?')});rate.recent=rate.recent.slice(-50);}
 limited_(until,at){const error=new Error('LOGIN_RATE_LIMITED');error.code='LOGIN_RATE_LIMITED';error.retry_after_ms=Math.max(1000,Math.min(60000,until-at));throw error;}
 derive_(password,salt,iterations,phase){const start=Date.now();try{return this.hash(password,salt,iterations);}finally{try{this.onHashTiming({hash_ms:Date.now()-start,iterations,phase});}catch(ignore){}}}
 login(username,password){
  if(typeof username!=='string'||typeof password!=='string'||username.length>60||password.length>128)fail('INVALID_LOGIN');
  username=username.toLowerCase().trim();const accountKey=digest(username);
  // Reserve a short-lived hash slot under lock, before any PBKDF2. No sleeping under lock.
  const reservation=this.store.lock(()=>{
   const state=this.store.read(),at=this.now(),rate=this.rate_(state,at),account=rate.accounts[accountKey]||{},until=Math.max(rate.global.next_at||0,account.next_at||0);
   if(until>at||Object.keys(rate.leases).length>=this.maxConcurrent){this.audit_(rate,username,at);this.store.write(state);this.limited_(until>at?until:at+1000,at);}
   const lease=this.random();rate.leases[lease]=at+120000;this.store.write(state);
   const found=Object.values(state.users).find(u=>u.username===username);return {lease,candidate:found?{...found}:undefined};
  });
  const candidate=reservation.candidate,target=candidate||{salt:'0'.repeat(32),iterations:this.passwordIterations,password_hash:'0'.repeat(64)};
  let valid=false,upgrade;
  try{
   valid=equal(this.derive_(password,target.salt,target.iterations,'verify'),target.password_hash);
   if(valid&&candidate?.active!==false&&candidate.iterations<this.passwordIterations){const salt=this.random();upgrade={salt,iterations:this.passwordIterations,scheme:'pbkdf2-sha256',password_hash:this.derive_(password,salt,this.passwordIterations,'upgrade')};}
  }catch(error){this.store.lock(()=>{const state=this.store.read();if(state.login_rate)delete state.login_rate.leases[reservation.lease];this.store.write(state);});throw error;}
  return this.store.lock(()=>{
   const state=this.store.read(),at=this.now(),rate=this.rate_(state,at);delete rate.leases[reservation.lease];
   const user=candidate&&state.users[candidate.id];
   const current=user&&user.active!==false&&user.version===candidate.version&&user.salt===candidate.salt&&user.password_hash===candidate.password_hash&&user.iterations===candidate.iterations;
   if(!valid||!current){
    const bump=(bucket,threshold)=>{const failures=(bucket?.failures||0)+1,wait=failures<threshold?0:Math.min(60000,1000*2**Math.min(6,failures-threshold));return {failures,last_failure:at,next_at:at+wait};};
    rate.global=bump(rate.global,this.globalAttempts);rate.accounts[accountKey]=bump(rate.accounts[accountKey],this.maxAttempts);
    if(Object.keys(rate.accounts).length>256){const oldest=Object.keys(rate.accounts).filter(k=>k!==accountKey).sort((a,b)=>rate.accounts[a].last_failure-rate.accounts[b].last_failure)[0];delete rate.accounts[oldest];}
    this.audit_(rate,username,at);this.store.write(state);fail('INVALID_LOGIN');
   }
   // Old hard-lock fields no longer deny correct credentials. Do not reset the global bucket.
   delete rate.accounts[accountKey];user.failed=0;user.locked_until=0;if(upgrade)Object.assign(user,upgrade);
   state.sessions=state.sessions||{};for(const [key,session] of Object.entries(state.sessions))if(session.expires_at<=at)delete state.sessions[key];
   if(Object.keys(state.sessions).length>=100){this.store.write(state);fail('SESSION_CAPACITY');}
   const token=this.random()+this.random();state.sessions[digest(token)]={user_id:user.id,user_version:user.version,expires_at:at+this.sessionMs};
   return this.result_(state,token,user,at);
  });
 }
 failedLogins(token){const state=this.store.read(),{user}=this.session_(state,token);if(!user.roles.includes('director'))fail('FORBIDDEN');return (state.login_rate?.recent||[]).slice(-50).map(r=>({at:r.at,username:r.username}));}

 session_(state,token){
  if(typeof token!=='string'||!/^[a-f0-9]{64,128}$/.test(token))fail('AUTH_REQUIRED');
  const session=state.sessions?.[digest(token)],user=session&&state.users[session.user_id];
  if(!session||session.expires_at<=this.now()||!user||user.active===false||user.version!==session.user_version)fail('AUTH_REQUIRED');
  return {session,user};
 }
 result_(state,token,user,at){
  const session=state.sessions[digest(token)],code=this.random()+this.random();
  session.resume_hash=digest(code);session.resume_expires_at=Math.min(at+10*60000,session.expires_at);this.store.write(state);
  return {token,actor:{id:user.id,name:user.name,roles:user.roles,active:true},expires_at:session.expires_at,resume_code:code,resume_expires_at:session.resume_expires_at};
 }
 resumeTicket(token){return this.store.lock(()=>{const state=this.store.read(),{user}=this.session_(state,token);return this.result_(state,token,user,this.now());});}
 resume(code){
  if(typeof code!=='string'||!/^[a-f0-9]{64,128}$/.test(code))fail('AUTH_REQUIRED');
  return this.store.lock(()=>{
   const state=this.store.read(),at=this.now(),hash=digest(code),entry=Object.entries(state.sessions||{}).find(([,s])=>s.resume_hash===hash);
   if(!entry)fail('AUTH_REQUIRED');const [oldKey,session]=entry,user=state.users[session.user_id];
   if(session.resume_expires_at<=at||session.expires_at<=at||!user||user.active===false||session.user_version!==user.version)fail('AUTH_REQUIRED');
   const token=this.random()+this.random();delete state.sessions[oldKey];state.sessions[digest(token)]={user_id:user.id,user_version:user.version,expires_at:session.expires_at};
   return this.result_(state,token,user,at);
  });
 }
 context(token){
  const state=this.store.read(),{user}=this.session_(state,token);
  return {actor:{id:user.id,name:user.name,roles:user.roles,active:true},directory:Object.fromEntries(Object.values(state.users).map(u=>[u.id,{id:u.id,name:u.name,roles:u.roles,active:u.active,area:u.area||''}]))};
 }
 actor(token){return this.context(token).actor;}
 logout(token){this.store.lock(()=>{const state=this.store.read();if(typeof token==='string')delete state.sessions?.[digest(token)];this.store.write(state);});}
 directory(){return Object.fromEntries(Object.values(this.store.read().users).map(u=>[u.id,{id:u.id,name:u.name,roles:u.roles,active:u.active,area:u.area||''}]));}
}
module.exports={Auth,createUser,passwordHash,digest};
