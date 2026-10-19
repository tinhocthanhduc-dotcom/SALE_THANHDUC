'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {Auth,passwordHash}=require('../auth.cjs');
function fixture(change){
 const salt='01'.repeat(16),password='SyntheticPassword2026!';let held=false,reads=0,writes=0,hashes=0;
 let state={users:{u:{id:'u',username:'tech',name:'Thợ',roles:['technician'],version:1,active:true,salt,iterations:2,password_hash:passwordHash(password,salt,2),failed:0,locked_until:0}},sessions:{}};
 const store={read(){reads++;return structuredClone(state);},write(next){assert(held);writes++;state=next;},lock(fn){assert(!held);held=true;try{return fn();}finally{held=false;}}};
 const auth=new Auth({store,random:()=>crypto.randomBytes(16).toString('hex'),now:()=>1000,passwordIterations:2,hash:(...args)=>{assert(!held,'PBKDF2 must not hold the shared lock');hashes++;if(change)change(state);return passwordHash(...args);}});return {auth,password,get state(){return state;},get reads(){return reads;},get writes(){return writes;},get hashes(){return hashes;}};
}
test('login reserves under lock, derives outside it, rereads credentials and stores only session digest',()=>{const f=fixture(),login=f.auth.login('tech',f.password);assert.equal(f.reads,2);assert.equal(f.writes,2);assert.equal(f.state.sessions[login.token],undefined);assert.equal(Object.values(f.state.sessions)[0].user_id,'u');assert.deepEqual(f.state.login_rate.leases,{});});
test('credential changes and deactivation during hashing block login',()=>{for(const change of [s=>s.users.u.version++,s=>s.users.u.active=false,s=>s.users.u.password_hash='00'.repeat(32)]){const f=fixture(change);assert.throws(()=>f.auth.login('tech',f.password),/INVALID_LOGIN/);assert.deepEqual(f.state.sessions,{});assert.deepEqual(f.state.login_rate.leases,{});}});
test('legacy hard-lock fields cannot deny correct credentials',()=>{const f=fixture(s=>s.users.u.locked_until=901000);assert.equal(f.auth.login('tech',f.password).actor.id,'u');assert.equal(f.state.users.u.locked_until,0);});
test('failed login preserves a concurrent failure recorded during hashing',()=>{const f=fixture(s=>{s.login_rate.global={failures:4,last_failure:1000,next_at:0};});assert.throws(()=>f.auth.login('tech','wrong'),/INVALID_LOGIN/);assert.equal(f.state.login_rate.global.failures,5);assert.equal(f.state.users.u.locked_until,0);});
