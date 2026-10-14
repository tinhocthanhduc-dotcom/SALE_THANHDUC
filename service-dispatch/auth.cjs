'use strict';
const {pbkdf2}=require('@noble/hashes/pbkdf2');
const {sha256}=require('@noble/hashes/sha256');
const {bytesToHex,hexToBytes}=require('@noble/hashes/utils');
function fail(code){const e=new Error(code);e.code=code;throw e;}
function utf8(text){const out=[];for(const char of text){let n=char.codePointAt(0);if(n>=0xd800&&n<=0xdfff)n=0xfffd;if(n<128)out.push(n);else if(n<2048)out.push(192|(n>>6),128|(n&63));else if(n<65536)out.push(224|(n>>12),128|((n>>6)&63),128|(n&63));else out.push(240|(n>>18),128|((n>>12)&63),128|((n>>6)&63),128|(n&63));}return Uint8Array.from(out);}
function digest(text){return bytesToHex(sha256(utf8(text)));}
function passwordHash(password,salt,iterations=600000){return bytesToHex(pbkdf2(sha256,utf8(password),hexToBytes(salt),{c:iterations,dkLen:32}));}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;let result=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)result|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return result===0;}
function createUser({id,username,name,roles,password,random}){
 if(!id||typeof username!=='string'||!/^[a-z0-9_.-]{3,60}$/i.test(username)||!name||!Array.isArray(roles)||!roles.length||roles.some(r=>!['dispatcher','technician','director','warehouse','finance'].includes(r)))fail('INVALID_USER');
 if(typeof password!=='string'||password.length<12||password.length>128)fail('WEAK_PASSWORD');
 const salt=random();return {id,username:username.toLowerCase(),name,roles,active:true,version:1,scheme:'pbkdf2-sha256',iterations:600000,salt,password_hash:passwordHash(password,salt),failed:0,locked_until:0};
}
class Auth {
 constructor({store,random,now=()=>Date.now(),sessionMs=8*3600000,lockMs=15*60000,maxAttempts=5}){Object.assign(this,{store,random,now,sessionMs,lockMs,maxAttempts});}
 login(username,password){
  if(typeof username!=='string'||typeof password!=='string'||username.length>60||password.length>128)fail('INVALID_LOGIN');
  const snapshot=this.store.read(),candidate=Object.values(snapshot.users).find(u=>u.username===username.toLowerCase().trim());
  // Expensive work runs outside the shared ScriptLock. Recheck credentials and lockout inside it.
  const target=candidate||{salt:'0'.repeat(32),iterations:600000,password_hash:'0'.repeat(64)};
  const valid=equal(passwordHash(password,target.salt,target.iterations),target.password_hash);
  return this.store.lock(()=>{
   const state=this.store.read(),user=candidate&&state.users[candidate.id],at=this.now();
   if(!user||user.active===false||user.locked_until>at||user.version!==candidate.version||user.salt!==candidate.salt||user.password_hash!==candidate.password_hash||user.iterations!==candidate.iterations)fail('INVALID_LOGIN');
   if(!valid){user.failed=(user.failed||0)+1;if(user.failed>=this.maxAttempts){user.locked_until=at+this.lockMs;user.failed=0;}this.store.write(state);fail('INVALID_LOGIN');}
   user.failed=0;user.locked_until=0;state.sessions=state.sessions||{};
   for(const [key,session] of Object.entries(state.sessions))if(session.expires_at<=at)delete state.sessions[key];
   if(Object.keys(state.sessions).length>=100)fail('SESSION_CAPACITY');
   const token=this.random()+this.random();state.sessions[digest(token)]={user_id:user.id,user_version:user.version,expires_at:at+this.sessionMs};this.store.write(state);
   return {token,actor:{id:user.id,name:user.name,roles:user.roles,active:true},expires_at:at+this.sessionMs};
  });
 }
 context(token){
  if(typeof token!=='string'||!/^[a-f0-9]{64,128}$/.test(token))fail('AUTH_REQUIRED');
  const state=this.store.read(),session=state.sessions?.[digest(token)],user=session&&state.users[session.user_id];
  if(!session||session.expires_at<=this.now()||!user||user.active===false||user.version!==session.user_version)fail('AUTH_REQUIRED');
  return {actor:{id:user.id,name:user.name,roles:user.roles,active:true},directory:Object.fromEntries(Object.values(state.users).map(u=>[u.id,{id:u.id,name:u.name,roles:u.roles,active:u.active,area:u.area||''}]))};
 }
 actor(token){return this.context(token).actor;}
 logout(token){this.store.lock(()=>{const state=this.store.read();if(typeof token==='string')delete state.sessions?.[digest(token)];this.store.write(state);});}
 directory(){return Object.fromEntries(Object.values(this.store.read().users).map(u=>[u.id,{id:u.id,name:u.name,roles:u.roles,active:u.active,area:u.area||''}]));}
}
module.exports={Auth,createUser,passwordHash,digest};
