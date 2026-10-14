'use strict';
const Domain=require('./domain.cjs');
const {digest}=require('./auth.cjs');
function fail(code){const e=new Error(code);e.code=code;throw e;}
function createService({auth,repository,files,now,id}){
 const state=()=>repository.snapshot().state;
 const authorized=(token,orderId)=>{const actor=auth.actor(token),order=state().orders[orderId];if(!order||!Domain.canRead(actor,order))fail('FORBIDDEN');return actor;};
 return {
  login:(username,password)=>auth.login(username,password),logout:token=>auth.logout(token),
  query(token,orderId){const actor=auth.actor(token),current=state();if(orderId&&(!current.orders[orderId]||!Domain.canRead(actor,current.orders[orderId])))fail('FORBIDDEN');const result=Domain.project(current,actor,auth.directory(),now());if(orderId){result.orders=result.orders.filter(o=>o.id===orderId);result.events=result.events.filter(e=>e.order_id===orderId);}return result;},
  command(token,command){if(command.type==='add_evidence')fail('FORBIDDEN');const actor=auth.actor(token);return repository.submit(command,{actor,directory:auth.directory(),now,id});},
  upload(token,payload){
   const actor=authorized(token,payload.order_id);
   if(!['after','handover'].includes(payload.kind)||!['image/jpeg','image/png','image/webp'].includes(payload.mime)||typeof payload.base64!=='string'||payload.base64.length>550000||!/^[A-Za-z0-9+/]+={0,2}$/.test(payload.base64))fail('INVALID_IMAGE');
   if(!payload.idempotency_key)fail('REQUIRED_FIELD');
   const uploadDigest=digest(JSON.stringify({order_id:payload.order_id,kind:payload.kind,mime:payload.mime,base64:payload.base64,expected_version:payload.expected_version}));
   const prior=state().commands[actor.id+':'+payload.idempotency_key];
   if(prior){if(prior.result.upload_digest!==uploadDigest)fail('IDEMPOTENCY_CONFLICT');return {...prior.result,replayed:true};}
   const file=files.save(payload.mime,payload.base64);
   try{return repository.submit({type:'add_evidence',idempotency_key:payload.idempotency_key,expected_version:payload.expected_version,payload:{order_id:payload.order_id,kind:payload.kind,mime:payload.mime,file_id:file,upload_digest:uploadDigest}},{actor,directory:auth.directory(),now,id,evidence_verified:true});}
   catch(e){
    // A prepared journal may already own the file. Recover before deciding cleanup.
    let removable=false;try{const persisted=state();removable=!Object.values(persisted.orders).some(o=>o.evidence.some(item=>item.file_id===file));}catch(ignore){/* Preserve on uncertain recovery; reconcile later. */}
    if(removable)files.remove(file);throw e;
   }
  },
  image(token,orderId,evidenceId){authorized(token,orderId);const evidence=state().orders[orderId].evidence.find(e=>e.id===evidenceId);if(!evidence)fail('FORBIDDEN');return files.read(evidence.file_id);}
 };
}
module.exports={createService};
