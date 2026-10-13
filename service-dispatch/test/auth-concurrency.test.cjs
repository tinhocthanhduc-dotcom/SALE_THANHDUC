'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Auth,passwordHash}=require('../auth.cjs');
function fixture(change){
 const salt='01'.repeat(16),password='SyntheticPassword2026!';let held=false,reads=0,writes=0;
 let state={users:{u:{id:'u',username:'tech',name:'Thợ',roles:['technician'],version:1,active:true,salt,iterations:2,password_hash:passwordHash(password,salt,2),failed:0,locked_until:0}},sessions:{}};
 const store={read(){reads++;const copy=structuredClone(state);if(!held){const value=copy.users.u.salt;let accesses=0;Object.defineProperty(copy.users.u,'salt',{get(){if(accesses++===0)assert.equal(held,false,'password derivation must not hold shared lock');return value;}});}return copy;},write(next){assert(held);writes++;state=next;},lock(fn){assert(!held);if(change)change(state);held=true;try{return fn();}finally{held=false;}}};
 const auth=new Auth({store,random:()=> 'ab'.repeat(16),now:()=>1000});return {auth,password,get state(){return state;},get reads(){return reads;},get writes(){return writes;}};
}
test('login derives outside lock, rereads before writing and stores only session digest',()=>{const f=fixture(),login=f.auth.login('tech',f.password);assert.equal(f.reads,2);assert.equal(f.writes,1);assert.equal(f.state.sessions[login.token],undefined);assert.equal(Object.values(f.state.sessions)[0].user_id,'u');});
test('credential changes, deactivation and concurrent lockout block login after derivation',()=>{for(const change of [s=>s.users.u.version++,s=>s.users.u.active=false,s=>s.users.u.locked_until=2000,s=>s.users.u.password_hash='00'.repeat(32)]){const f=fixture(change);assert.throws(()=>f.auth.login('tech',f.password),/INVALID_LOGIN/);assert.equal(f.writes,0);assert.deepEqual(f.state.sessions,{});}});
test('failed login uses latest failure count and cannot overwrite a concurrent attempt',()=>{const f=fixture(s=>s.users.u.failed=4);assert.throws(()=>f.auth.login('tech','wrong'),/INVALID_LOGIN/);assert.equal(f.state.users.u.locked_until,901000);assert.equal(f.state.users.u.failed,0);});
