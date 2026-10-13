'use strict';
// No authentication or IO here. Actor and employee directory must come from the server.
const clone=value=>JSON.parse(JSON.stringify(value));
function fail(code){const e=new Error(code);e.code=code;throw e;}
function required(v){if(typeof v!=='string'||!v.trim())fail('REQUIRED_FIELD');return v.trim();}
function date(v){if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT/.test(v)||!Number.isFinite(Date.parse(v)))fail('INVALID_DATE');return new Date(v).toISOString();}
function canonical(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';}
function emptyState(){return {customers:{},machines:{},orders:{},commands:{},events:[],sequences:{}};}
const roles={create_customer:['dispatcher','director'],create_machine:['dispatcher','director'],create_order:['dispatcher','director'],assign:['dispatcher','director'],accept:['technician'],schedule:['technician'],start:['technician'],wait_parts:['technician'],resume_schedule:['technician'],request_transfer:['technician'],approve_transfer:['dispatcher','director'],reject_transfer:['dispatcher','director'],cannot_complete:['technician'],complete:['technician'],cancel:['dispatcher','director'],add_evidence:['technician']};
function permitted(actor,allowed){return actor&&actor.active!==false&&Array.isArray(actor.roles)&&actor.roles.some(r=>allowed.includes(r));}
function canRead(actor,order){return permitted(actor,['dispatcher','director'])||(permitted(actor,['technician'])&&order.technician_id===actor.id);}
function employee(directory,id){const person=directory[id];if(!person||person.active===false||!person.roles.includes('technician'))fail('UNKNOWN_TECHNICIAN');return person;}
function number(state,prefix,iso){const day=new Date(Date.parse(iso)+7*3600000).toISOString().slice(0,10).replace(/-/g,'');const key=prefix+':'+day;const n=(state.sequences[key]||0)+1;if(!Number.isSafeInteger(n))fail('SEQUENCE_OVERFLOW');state.sequences[key]=n;return prefix+'-'+day+'-'+String(n).padStart(4,'0');}
function execute(state,command,context){
 const {actor,directory,now,id}=context;
 if(!command||!Object.hasOwn(roles,command.type))fail('UNKNOWN_COMMAND');
 if(!actor?.id||!permitted(actor,roles[command.type]))fail('FORBIDDEN');
 const payload=command.payload||{},key=actor.id+':'+required(command.idempotency_key);
 const fingerprint=canonical({type:command.type,payload,expected_version:command.expected_version});
 const previous=state.commands[key];
 // Reassignment removes access even to replay receipts from the old technician.
 if(payload.order_id&&(!state.orders[payload.order_id]||!canRead(actor,state.orders[payload.order_id])))fail('FORBIDDEN');
 if(previous){if(previous.fingerprint!==fingerprint)fail('IDEMPOTENCY_CONFLICT');return {state:clone(state),result:{...clone(previous.result),replayed:true}};}
 const next=clone(state),at=date(now());let entity,order;
 const fresh=()=>{const value=required(id());if(next.customers[value]||next.machines[value]||next.orders[value]||next.events.some(e=>e.id===value))fail('DUPLICATE_ID');return value;};
 const requireState=(...statuses)=>{if(!statuses.includes(order.status))fail('INVALID_TRANSITION');};
 if(command.type==='create_customer'){
  const phone=required(payload.phone);if(!/^[+\d ()-]{7,25}$/.test(phone))fail('INVALID_PHONE');
  entity={id:fresh(),customer_no:number(next,'KH',at),name:required(payload.name),phone,address:required(payload.address),area:required(payload.area),terms:payload.terms==='credit'?'credit':'immediate',version:1,created_at:at};next.customers[entity.id]=entity;
 }else if(command.type==='create_machine'){
  if(!next.customers[payload.customer_id])fail('UNKNOWN_CUSTOMER');
  entity={id:fresh(),customer_id:payload.customer_id,model:required(payload.model),serial:typeof payload.serial==='string'?payload.serial.trim():'',version:1,created_at:at};next.machines[entity.id]=entity;
 }else if(command.type==='create_order'){
  const customer=next.customers[payload.customer_id],machine=next.machines[payload.machine_id];
  if(!customer)fail('UNKNOWN_CUSTOMER');if(!machine||machine.customer_id!==customer.id)fail('MACHINE_CUSTOMER_MISMATCH');
  if(!['hotline','zalo','other'].includes(payload.source)||!['normal','urgent','critical'].includes(payload.priority))fail('INVALID_CATEGORY');
  const appointmentStart=date(payload.appointment_start),appointmentEnd=date(payload.appointment_end);if(appointmentStart>=appointmentEnd)fail('INVALID_APPOINTMENT');
  order={id:fresh(),order_no:number(next,'TD',at),customer_id:customer.id,machine_id:machine.id,customer_snapshot:clone(customer),machine_snapshot:clone(machine),address:required(payload.address),request:required(payload.request),area:customer.area,terms:customer.terms,source:payload.source,priority:payload.priority,status:'new',version:1,created_at:at,updated_at:at,assignments:[],appointments:[{start:appointmentStart,end:appointmentEnd,kind:'requested',at,actor_id:actor.id}],visits:[],transfers:[],parts_requests:[],evidence:[],payment_status:'unpaid',financial_scope:'not_implemented'};
  next.orders[order.id]=order;entity=order;
 }else{
  order=next.orders[payload.order_id];if(!order)fail('UNKNOWN_ORDER');
  if(command.expected_version!==order.version)fail('VERSION_CONFLICT');
  if(permitted(actor,['technician'])&&!permitted(actor,['dispatcher','director'])&&actor.id!==order.technician_id)fail('FORBIDDEN');
  const assignment=order.assignments.at(-1);
  const setSchedule=()=>{const start=date(payload.start),end=date(payload.end);if(start>=end)fail('INVALID_APPOINTMENT');const confirmation=required(payload.customer_confirmation);if(order.appointments.some(a=>a.kind==='confirmed'))required(payload.reason);order.appointments.push({start,end,kind:'confirmed',customer_confirmation:confirmation,reason:payload.reason||'',at,actor_id:actor.id});order.status='scheduled';};
  switch(command.type){
   case 'assign':{
    requireState('new','assigned','accepted','scheduled','unable','waiting_parts');employee(directory,payload.technician_id);
    if(order.technician_id)required(payload.reason);
    if(assignment&&!assignment.ended_at){assignment.ended_at=at;assignment.end_reason=payload.reason||'Giao lại';}
    order.technician_id=payload.technician_id;order.assignments.push({id:fresh(),technician_id:payload.technician_id,assigned_at:at,assigned_by:actor.id,reason:payload.reason||''});order.status='assigned';
    for(const transfer of order.transfers.filter(t=>t.status==='pending')){transfer.status='superseded';transfer.resolved_at=at;}
    break;
   }
   case 'accept':requireState('assigned');if(order.technician_id!==actor.id)fail('FORBIDDEN');assignment.accepted_at=at;order.status='accepted';break;
   case 'schedule':requireState('accepted','scheduled','unable');if(order.technician_id!==actor.id)fail('FORBIDDEN');setSchedule();break;
   case 'start':requireState('scheduled');if(order.technician_id!==actor.id)fail('FORBIDDEN');order.visits.push({id:fresh(),technician_id:actor.id,started_at:at});order.status='working';break;
   case 'wait_parts':{
    requireState('working');if(order.technician_id!==actor.id)fail('FORBIDDEN');
    const request={id:fresh(),item:required(payload.item),qty:payload.qty,reason:required(payload.reason),status:'requested',created_at:at};if(!Number.isSafeInteger(request.qty)||request.qty<=0)fail('INVALID_QUANTITY');order.parts_requests.push(request);order.status='waiting_parts';order.waiting_since=at;break;
   }
   case 'resume_schedule':requireState('waiting_parts');if(order.technician_id!==actor.id)fail('FORBIDDEN');fail('WAREHOUSE_INTEGRATION_REQUIRED');break;
   case 'request_transfer':{
    requireState('accepted','scheduled','working','waiting_parts','unable');if(order.technician_id!==actor.id)fail('FORBIDDEN');
    if(order.transfers.some(t=>t.status==='pending'))fail('TRANSFER_PENDING');employee(directory,payload.technician_id);if(payload.technician_id===actor.id)fail('SAME_TECHNICIAN');
    order.transfers.push({id:fresh(),from:actor.id,to:payload.technician_id,reason:required(payload.reason),status:'pending',at});break;
   }
   case 'approve_transfer':{
    const transfer=order.transfers.find(t=>t.id===payload.transfer_id&&t.status==='pending');if(!transfer)fail('UNKNOWN_TRANSFER');employee(directory,transfer.to);if(order.technician_id!==transfer.from)fail('TRANSFER_STALE');
    transfer.status='approved';transfer.resolved_at=at;transfer.resolved_by=actor.id;transfer.handover_plan=required(payload.handover_plan);
    if(assignment&&!assignment.ended_at){assignment.ended_at=at;assignment.end_reason=transfer.reason;}
    for(const visit of order.visits.filter(v=>!v.ended_at)){visit.ended_at=at;visit.result='transferred';}
    order.technician_id=transfer.to;order.assignments.push({id:fresh(),technician_id:transfer.to,assigned_at:at,assigned_by:actor.id,reason:transfer.reason});order.status='assigned';break;
   }
   case 'reject_transfer':{
    const transfer=order.transfers.find(t=>t.id===payload.transfer_id&&t.status==='pending');if(!transfer)fail('UNKNOWN_TRANSFER');transfer.status='rejected';transfer.resolved_at=at;transfer.resolved_by=actor.id;transfer.rejection_reason=required(payload.reason);break;
   }
   case 'cannot_complete':requireState('scheduled','working');if(order.technician_id!==actor.id)fail('FORBIDDEN');order.unable_reason=required(payload.reason);order.status='unable';for(const visit of order.visits.filter(v=>!v.ended_at)){visit.ended_at=at;visit.result='unable';}break;
   case 'add_evidence':{
    requireState('working');if(order.technician_id!==actor.id||context.evidence_verified!==true)fail('FORBIDDEN');if(!['after','handover'].includes(payload.kind))fail('INVALID_EVIDENCE_KIND');
    order.evidence.push({id:fresh(),visit_id:order.visits.at(-1).id,file_id:required(payload.file_id),kind:payload.kind,mime:required(payload.mime),at,actor_id:actor.id});break;
   }
   case 'complete':{
    requireState('working');if(order.technician_id!==actor.id)fail('FORBIDDEN');
    if(order.transfers.some(t=>t.status==='pending'))fail('TRANSFER_PENDING');if(order.parts_requests.some(r=>r.status!=='resolved'&&r.status!=='rejected'))fail('OPEN_PARTS_REQUEST');
    const visit=order.visits.at(-1);const currentEvidence=order.evidence.filter(e=>e.actor_id===actor.id&&e.visit_id===visit.id);
    if(!currentEvidence.some(e=>e.kind==='after')||!currentEvidence.some(e=>e.kind==='handover'))fail('EVIDENCE_REQUIRED');
    order.work_summary=required(payload.work_summary);order.status='accepted_work';order.accepted_at=at;visit.ended_at=at;visit.result='accepted';order.dossier_status='awaiting_reconciliation';break;
   }
   case 'cancel':requireState('new','assigned','accepted','scheduled','working','waiting_parts','unable');order.cancel_reason=required(payload.reason);order.status='cancelled';for(const visit of order.visits.filter(v=>!v.ended_at)){visit.ended_at=at;visit.result='cancelled';}break;
  }
  order.version++;order.updated_at=at;entity=order;
 }
 const result={id:entity.id,order_id:order?.id,order_no:order?.order_no,version:entity.version,status:order?.status,replayed:false};
 if(command.type==='create_customer'&&Object.values(state.customers).some(c=>c.phone.replace(/\D/g,'')===entity.phone.replace(/\D/g,'')))result.warning='DUPLICATE_PHONE';
 if(command.type==='add_evidence'){result.file_id=payload.file_id;result.upload_digest=payload.upload_digest;}
 next.events.push({id:fresh(),entity_id:entity.id,order_id:order?.id,type:command.type,actor_id:actor.id,at,version:entity.version,reason:payload.reason||''});next.commands[key]={fingerprint,result:clone(result)};return {state:next,result};
}
function project(state,actor,directory){
 if(!permitted(actor,['dispatcher','director','technician']))fail('FORBIDDEN');
 const orders=Object.values(state.orders).filter(o=>canRead(actor,o));const ids=new Set(orders.map(o=>o.id));
 const canManage=permitted(actor,['dispatcher','director']);
 return {actor:{id:actor.id,name:actor.name,roles:actor.roles},orders:clone(orders),customers:canManage?clone(Object.values(state.customers)):[],machines:canManage?clone(Object.values(state.machines)):[],technicians:Object.values(directory).filter(p=>p.active!==false&&p.roles.includes('technician')).map(p=>({id:p.id,name:p.name,area:p.area||'',open_count:canManage||p.id===actor.id?orders.filter(o=>o.technician_id===p.id&&!['accepted_work','cancelled'].includes(o.status)).length:null})),events:clone(state.events.filter(e=>canManage||ids.has(e.order_id)))};
}
module.exports={emptyState,execute,project,canRead};
