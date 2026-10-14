'use strict';
const Domain=require('./domain.cjs');
const {digest}=require('./auth.cjs');
function fail(code){const e=new Error(code);e.code=code;throw e;}
function createService({auth,repository,files,now,id,changes={read:()=>({version:0})},catalogue={read:()=>({verified_copy:false,stock:[],accounts:[],categories:[],customers:[],employees:[]})}}){
 const state=()=>repository.snapshot().state;
 return {
  integrationSnapshot_:state,integrationCommit_:(command,context)=>repository.submit(command,context),
  login:(username,password)=>auth.login(username,password),logout:token=>auth.logout(token),
  changes(token){auth.actor(token);return changes.read();},
  query(token,orderId){const actor=auth.actor(token),change=changes.read(),current=state();if(orderId&&(!current.orders[orderId]||!Domain.canRead(actor,current.orders[orderId])))fail('FORBIDDEN');const result=Domain.project(current,actor,auth.directory(),now(),catalogue.read());result.change_version=change.version;if(orderId){result.orders=result.orders.filter(o=>o.id===orderId);result.events=result.events.filter(e=>e.order_id===orderId);}return result;},
  command(token,command){if(['add_evidence','sync_result'].includes(command.type))fail('FORBIDDEN');const actor=auth.actor(token);return repository.submit(command,{actor,directory:auth.directory(),now,id,catalogue:{...catalogue.read(),dispatch_employees:Object.values(auth.directory()).filter(p=>p.roles.includes('technician'))}});},
  upload(token,payload){
   const clock=()=>typeof performance==='object'?performance.now():Date.now(),started=clock(),timings={auth_ms:0,snapshot_ms:0,locked_snapshot_ms:0,drive_ms:0,sheets_ms:0,projection_ms:0};
   let tick=clock();const {actor,directory}=auth.context(token);timings.auth_ms=clock()-tick;
   tick=clock();const current=state();timings.snapshot_ms=clock()-tick;
   const order=current.orders[payload.order_id];if(!order||!Domain.canRead(actor,order))fail('FORBIDDEN');
   if(!['after','handover','payment_receipt'].includes(payload.kind)||!['image/jpeg','image/png','image/webp'].includes(payload.mime)||typeof payload.base64!=='string'||payload.base64.length>550000||!/^[A-Za-z0-9+/]+={0,2}$/.test(payload.base64))fail('INVALID_IMAGE');
   if(payload.thumbnail_base64!==undefined&&(typeof payload.thumbnail_base64!=='string'||payload.thumbnail_base64.length>40000||!/^[A-Za-z0-9+/]+={0,2}$/.test(payload.thumbnail_base64)))fail('INVALID_IMAGE');
   if(!payload.idempotency_key)fail('REQUIRED_FIELD');
   const uploadDigest=digest(JSON.stringify({order_id:payload.order_id,kind:payload.kind,...(payload.payment_id?{payment_id:payload.payment_id}:{}),mime:payload.mime,base64:payload.base64,expected_version:payload.expected_version,...(payload.thumbnail_base64?{thumbnail_base64:payload.thumbnail_base64}:{})}));
   const project=snapshot=>{const at=clock(),o=snapshot.state.orders[payload.order_id];if(!o||!Domain.canRead(actor,o))fail('FORBIDDEN');const projected=Domain.project({...snapshot.state,orders:{[o.id]:o},events:snapshot.state.events.filter(e=>e.order_id===o.id),customers:{},machines:{}},actor,directory,now());timings.projection_ms+=clock()-at;return {order:projected.orders[0],events:projected.events};};
   const response=(receipt,projection)=>{timings.total_ms=clock()-started;console.info('dispatch-upload-timing',JSON.stringify(timings));return {...receipt,...projection,timings};};
   const prior=current.commands[actor.id+':'+payload.idempotency_key];
   if(prior){if(prior.result.upload_digest!==uploadDigest)fail('IDEMPOTENCY_CONFLICT');return response({...prior.result,replayed:true},project({state:current}));}
   if(!actor.roles.includes('technician')||order.technician_id!==actor.id)fail('FORBIDDEN');if(payload.kind==='payment_receipt'){const receipt=current.payments?.[payload.payment_id];if(!receipt||receipt.actor_id!==actor.id||receipt.order_id!==order.id)fail('FORBIDDEN');if(!['accepted_work','unable'].includes(order.status))fail('INVALID_TRANSITION');}else if(order.status!=='working')fail('INVALID_TRANSITION');if(order.version!==payload.expected_version)fail('VERSION_CONFLICT');
   const saved=[];let projection;
   try{
    tick=clock();const file=files.save(payload.mime,payload.base64);saved.push(file);let thumbnail;
    if(payload.thumbnail_base64){thumbnail=files.save('image/jpeg',payload.thumbnail_base64);saved.push(thumbnail);}timings.drive_ms=clock()-tick;
    tick=clock();const receipt=repository.submit({type:'add_evidence',idempotency_key:payload.idempotency_key,expected_version:payload.expected_version,payload:{order_id:payload.order_id,kind:payload.kind,...(payload.payment_id?{payment_id:payload.payment_id}:{}),mime:payload.mime,file_id:file,thumbnail_file_id:thumbnail,upload_digest:uploadDigest}},{actor,directory,now,id,evidence_verified:true,onSnapshotRead:ms=>{timings.locked_snapshot_ms=ms;},onCommitted:snapshot=>{projection=project(snapshot);}});timings.sheets_ms=Math.max(0,clock()-tick-timings.projection_ms-timings.locked_snapshot_ms);
    // A concurrent identical request may have committed first; discard only our unused files.
    if(receipt.replayed)for(const file of saved)files.remove(file);
    return response(receipt,projection);
   }catch(e){
    // A prepared journal may already own either file. Preserve on uncertain recovery.
    try{const persisted=state(),owned=new Set(Object.values(persisted.orders).flatMap(o=>o.evidence.flatMap(item=>[item.file_id,item.thumbnail_file_id])));for(const file of saved)if(!owned.has(file))files.remove(file);}catch(ignore){}
    throw e;
   }
  },
  image(token,orderId,evidenceId,variant){const actor=auth.actor(token),current=state(),order=current.orders[orderId];if(!order||!Domain.canRead(actor,order))fail('FORBIDDEN');const evidence=order.evidence.find(e=>e.id===evidenceId);if(!evidence)fail('FORBIDDEN');if(variant==='thumbnail'&&!evidence.thumbnail_file_id)return {missing:true};return files.read(variant==='thumbnail'?evidence.thumbnail_file_id:evidence.file_id);}

 };
}
module.exports={createService};
