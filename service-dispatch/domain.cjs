'use strict';
// No authentication or IO here. Actor and employee directory must come from the server.
const clone=value=>JSON.parse(JSON.stringify(value));
function fail(code){const e=new Error(code);e.code=code;throw e;}
function required(v){if(typeof v!=='string'||!v.trim())fail('REQUIRED_FIELD');return v.trim();}
function date(v){if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT/.test(v)||!Number.isFinite(Date.parse(v)))fail('INVALID_DATE');return new Date(v).toISOString();}
function canonical(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';}
function emptyState(){return {customers:{},machines:{},orders:{},commands:{},events:[],sequences:{}};}
const roles={create_customer:['dispatcher','director'],create_machine:['dispatcher','director'],create_order:['dispatcher','director'],assign:['dispatcher','director'],accept:['technician'],schedule:['technician'],start:['technician'],wait_parts:['technician'],resume_schedule:['technician'],request_transfer:['technician'],approve_transfer:['dispatcher','director'],reject_transfer:['dispatcher','director'],cannot_complete:['technician'],complete:['technician'],cancel:['dispatcher','director'],add_evidence:['technician'],issue_parts:['warehouse','director'],reject_parts:['warehouse','director'],receive_parts:['technician'],resume_work:['technician'],collect_old_machine:['technician'],receive_old_machine:['warehouse','director'],report_parts_usage:['technician'],return_parts:['warehouse','director']};
function permitted(actor,allowed){return actor&&actor.active!==false&&Array.isArray(actor.roles)&&actor.roles.some(r=>allowed.includes(r));}
function canRead(actor,order){return permitted(actor,['dispatcher','director'])||(permitted(actor,['warehouse'])&&(order.parts_requests.length>0||(order.collected_machines||[]).length>0))||(permitted(actor,['technician'])&&order.technician_id===actor.id);}
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
  entity={id:fresh(),customer_no:number(next,'KH',at),name:required(payload.name),phone,address:required(payload.address),area:typeof payload.area==='string'?payload.area.trim():'',terms:payload.terms==='credit'?'credit':'immediate',version:1,created_at:at};next.customers[entity.id]=entity;
 }else if(command.type==='create_machine'){
  if(!next.customers[payload.customer_id])fail('UNKNOWN_CUSTOMER');
  entity={id:fresh(),customer_id:payload.customer_id,model:required(payload.model),serial:typeof payload.serial==='string'?payload.serial.trim():'',version:1,created_at:at};next.machines[entity.id]=entity;
 }else if(command.type==='create_order'){
  const customer=next.customers[payload.customer_id],machine=next.machines[payload.machine_id];
  if(!customer)fail('UNKNOWN_CUSTOMER');if(payload.machine_id&&(!machine||machine.customer_id!==customer.id))fail('MACHINE_CUSTOMER_MISMATCH');
  if(!['hotline','zalo','other'].includes(payload.source)||!['normal','urgent','critical'].includes(payload.priority))fail('INVALID_CATEGORY');
  const serviceDate=new Date(Date.parse(at)+7*3600000).toISOString().slice(0,10);let appointmentStart=payload.appointment_start,appointmentEnd=payload.appointment_end;
  if(payload.appointment_time_start||payload.appointment_time_end){if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(payload.appointment_time_start||'')||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(payload.appointment_time_end||''))fail('INVALID_APPOINTMENT');appointmentStart=serviceDate+'T'+payload.appointment_time_start+':00+07:00';appointmentEnd=serviceDate+'T'+payload.appointment_time_end+':00+07:00';}
  const hasStart=!!appointmentStart,hasEnd=!!appointmentEnd;if(hasStart!==hasEnd)fail('INVALID_APPOINTMENT');const appointments=[];if(hasStart){const start=date(appointmentStart),end=date(appointmentEnd);if(start>=end)fail('INVALID_APPOINTMENT');appointments.push({start,end,kind:'requested',at,actor_id:actor.id});}
  order={id:fresh(),order_no:number(next,'TD',at),customer_id:customer.id,machine_id:machine?machine.id:null,customer_snapshot:clone(customer),machine_snapshot:machine?clone(machine):{model:'',serial:''},service_date:serviceDate,address:required(payload.address),request:required(payload.request),area:customer.area,terms:customer.terms,source:payload.source,priority:payload.priority,status:'new',version:1,created_at:at,updated_at:at,assignments:[],appointments,visits:[],transfers:[],parts_requests:[],evidence:[],payment_status:'unpaid',financial_scope:'not_implemented'};
  next.orders[order.id]=order;entity=order;
 }else{
  order=next.orders[payload.order_id];if(!order)fail('UNKNOWN_ORDER');
  if(command.expected_version!==order.version)fail('VERSION_CONFLICT');
  const assignment=order.assignments.at(-1);
  const partsReady=()=>order.parts_requests.every(r=>['received','usage_recorded','resolved','rejected'].includes(r.status));
  const hasCustody=()=>order.parts_requests.some(r=>['issued','received','usage_recorded'].includes(r.status))||(order.collected_machines||[]).some(m=>m.status==='with_technician');
  const noHandover=()=>{if(hasCustody())fail('HANDOVER_REQUIRED');};
  const part=()=>{const r=order.parts_requests.find(r=>r.id===payload.request_id);if(!r)fail('UNKNOWN_PARTS_REQUEST');return r;};
  const parts=()=>{const ids=payload.request_ids===undefined?[payload.request_id]:payload.request_ids;if(!Array.isArray(ids)||!ids.length||ids.length>50||new Set(ids).size!==ids.length)fail('INVALID_PARTS_LIST');return ids.map(requestId=>{const r=order.parts_requests.find(r=>r.id===requestId);if(!r)fail('UNKNOWN_PARTS_REQUEST');return r;});};
  const recordUsage=(r,usedQty,note)=>{if(r.status!=='received')fail('INVALID_TRANSITION');if(r.technician_id!==actor.id)fail('FORBIDDEN');if(!Number.isSafeInteger(usedQty)||usedQty<0||usedQty>r.issued_qty)fail('INVALID_QUANTITY');r.used_qty=usedQty;r.surplus_qty=r.issued_qty-usedQty;r.usage_note=required(note);r.usage_recorded_at=at;r.status=r.surplus_qty?'usage_recorded':'resolved';};
  const setSchedule=()=>{const start=date(payload.start),end=date(payload.end);if(start>=end)fail('INVALID_APPOINTMENT');const confirmation=required(payload.customer_confirmation);if(order.appointments.some(a=>a.kind==='confirmed'))required(payload.reason);order.appointments.push({start,end,kind:'confirmed',customer_confirmation:confirmation,reason:payload.reason||'',at,actor_id:actor.id});order.status='scheduled';};
  switch(command.type){
   case 'assign':{
    requireState('new','assigned','accepted','scheduled','unable','waiting_parts');employee(directory,payload.technician_id);
    const note=typeof payload.note==='string'?payload.note.trim():typeof payload.reason==='string'?payload.reason.trim():'';if(order.technician_id&&order.technician_id!==payload.technician_id)noHandover();
    if(assignment&&!assignment.ended_at){assignment.ended_at=at;assignment.end_reason=note||'Giao lại';}
    order.technician_id=payload.technician_id;order.assignments.push({id:fresh(),technician_id:payload.technician_id,assigned_at:at,assigned_by:actor.id,note,reason:note});order.status='assigned';
    for(const transfer of order.transfers.filter(t=>t.status==='pending')){transfer.status='superseded';transfer.resolved_at=at;}
    break;
   }
   case 'accept':requireState('assigned');if(order.technician_id!==actor.id)fail('FORBIDDEN');assignment.accepted_at=at;order.status='accepted';break;
   case 'schedule':requireState('accepted','scheduled','unable');if(order.technician_id!==actor.id)fail('FORBIDDEN');setSchedule();break;
   case 'start':requireState('accepted','scheduled');if(!partsReady())fail('PARTS_NOT_RECEIVED');if(order.technician_id!==actor.id)fail('FORBIDDEN');if(!order.appointments.length)fail('APPOINTMENT_REQUIRED');order.visits.push({id:fresh(),technician_id:actor.id,started_at:at});order.status='working';break;
   case 'wait_parts':{
    requireState('working','waiting_parts');if(order.technician_id!==actor.id)fail('FORBIDDEN');
    const items=payload.items===undefined?[{item:payload.item,qty:payload.qty}]:payload.items;if(!Array.isArray(items)||!items.length||items.length>50)fail('INVALID_PARTS_LIST');const lines=items.map(line=>{if(!line||typeof line!=='object')fail('INVALID_PARTS_LIST');const item=required(line.item);if(!Number.isSafeInteger(line.qty)||line.qty<=0)fail('INVALID_QUANTITY');return {item,qty:line.qty};});if(new Set(lines.map(line=>line.item.toLocaleLowerCase())).size!==lines.length)fail('DUPLICATE_PARTS_LINE');const reason=required(payload.reason),proposal={id:fresh(),request_no:number(next,'DX',at),reason,created_at:at,created_by:actor.id,line_ids:[]};
    for(const line of lines){const request={id:fresh(),...line,proposal_id:proposal.id,proposal_no:proposal.request_no,reason,status:'requested',created_at:at};proposal.line_ids.push(request.id);order.parts_requests.push(request);}order.parts_proposals=order.parts_proposals||[];order.parts_proposals.push(proposal);order.status='waiting_parts';order.waiting_since=at;break;
   }
   case 'issue_parts':{
    requireState('waiting_parts','assigned','accepted','scheduled','working','unable');const lines=parts();if(lines.some(r=>r.status!=='requested'))fail('INVALID_TRANSITION');employee(directory,order.technician_id);const note=required(payload.warehouse_note),issueNo=number(next,'PX',at);const serials=payload.serials||[];if(!Array.isArray(serials)||new Set(serials.map(s=>s&&s.request_id)).size!==serials.length||serials.some(s=>!s||!lines.some(r=>r.id===s.request_id)||typeof s.serial!=='string'))fail('INVALID_PARTS_LIST');
    for(const r of lines){r.issue_no=issueNo;r.issued_qty=r.qty;r.issued_at=at;r.issued_by=actor.id;r.technician_id=order.technician_id;r.serial=(serials.find(s=>s.request_id===r.id)?.serial||(lines.length===1&&typeof payload.serial==='string'?payload.serial:'')).trim();r.warehouse_note=note;r.status='issued';}break;
   }
   case 'reject_parts':{
    requireState('waiting_parts','assigned','accepted','scheduled','working','unable');const r=part();if(r.status!=='requested')fail('INVALID_TRANSITION');r.status='rejected';r.rejection_reason=required(payload.reason);r.rejected_by=actor.id;r.rejected_at=at;break;
   }
   case 'receive_parts':{
    requireState('waiting_parts','assigned','accepted','scheduled','working','unable');const lines=parts();if(order.technician_id!==actor.id||lines.some(r=>r.technician_id!==actor.id))fail('FORBIDDEN');if(lines.some(r=>r.status!=='issued'))fail('INVALID_TRANSITION');const confirmation=required(payload.receipt_confirmation);for(const r of lines){r.receipt_confirmation=confirmation;r.received_by=actor.id;r.received_at=at;r.status='received';}break;
   }
   case 'report_parts_usage':{
    requireState('working','accepted_work','cancelled','unable');const r=part();if(order.technician_id!==actor.id||r.technician_id!==actor.id)fail('FORBIDDEN');if(r.status!=='received')fail('INVALID_TRANSITION');
    if(payload.usage_confirmed!==undefined&&payload.usage_confirmed!==true)fail('USAGE_CONFIRMATION_REQUIRED');recordUsage(r,payload.used_qty,payload.usage_note);break;
   }
   case 'return_parts':{
    const r=part();if(r.status==='issued'&&order.status==='cancelled'){r.used_qty=0;r.surplus_qty=r.issued_qty;}else if(r.status!=='usage_recorded'||!r.surplus_qty)fail('INVALID_TRANSITION');r.return_confirmation=required(payload.return_confirmation);r.return_no=number(next,'PN',at);r.returned_qty=r.surplus_qty;r.returned_at=at;r.returned_by=actor.id;r.status='resolved';break;
   }
   case 'resume_work':{
    requireState('waiting_parts');if(order.technician_id!==actor.id)fail('FORBIDDEN');if(!partsReady())fail('PARTS_NOT_RECEIVED');const confirmation=required(payload.customer_confirmation);order.resumes=order.resumes||[];order.resumes.push({at,actor_id:actor.id,customer_confirmation:confirmation});
    if(!order.visits.some(v=>v.technician_id===actor.id&&!v.ended_at))order.visits.push({id:fresh(),technician_id:actor.id,started_at:at});order.status='working';order.resumed_at=at;break;
   }
   case 'resume_schedule':{
    requireState('waiting_parts');if(order.technician_id!==actor.id)fail('FORBIDDEN');if(!partsReady())fail('PARTS_NOT_RECEIVED');setSchedule();for(const visit of order.visits.filter(v=>!v.ended_at)){visit.ended_at=at;visit.result='waiting_parts';}break;
   }
   case 'collect_old_machine':{
    requireState('working','accepted_work');if(order.technician_id!==actor.id)fail('FORBIDDEN');if(!['exchange','repair'].includes(payload.purpose))fail('INVALID_CATEGORY');
    order.collected_machines=order.collected_machines||[];order.collected_machines.push({id:fresh(),receipt_no:number(next,'BN',at),model:required(payload.model),serial:typeof payload.serial==='string'?payload.serial.trim():'',condition:required(payload.condition),customer_confirmation:required(payload.customer_confirmation),purpose:payload.purpose,technician_id:actor.id,collected_at:at,status:'with_technician'});break;
   }
   case 'receive_old_machine':{
    const machine=(order.collected_machines||[]).find(m=>m.id===payload.collected_machine_id);if(!machine)fail('UNKNOWN_COLLECTED_MACHINE');if(machine.status!=='with_technician')fail('INVALID_TRANSITION');
    machine.warehouse_location=required(payload.warehouse_location);machine.warehouse_condition=required(payload.warehouse_condition);machine.warehouse_receipt_no=number(next,'NK',at);machine.received_at=at;machine.received_by=actor.id;machine.status='in_warehouse';break;
   }
   case 'request_transfer':{
    requireState('accepted','scheduled','working','waiting_parts','unable');if(order.technician_id!==actor.id)fail('FORBIDDEN');
    if(order.transfers.some(t=>t.status==='pending'))fail('TRANSFER_PENDING');employee(directory,payload.technician_id);if(payload.technician_id===actor.id)fail('SAME_TECHNICIAN');
    order.transfers.push({id:fresh(),from:actor.id,to:payload.technician_id,reason:required(payload.reason),status:'pending',at});break;
   }
   case 'approve_transfer':{
    const transfer=order.transfers.find(t=>t.id===payload.transfer_id&&t.status==='pending');if(!transfer)fail('UNKNOWN_TRANSFER');employee(directory,transfer.to);if(order.technician_id!==transfer.from)fail('TRANSFER_STALE');
    noHandover();transfer.status='approved';transfer.resolved_at=at;transfer.resolved_by=actor.id;transfer.handover_plan=required(payload.handover_plan);
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
    if(order.transfers.some(t=>t.status==='pending'))fail('TRANSFER_PENDING');if(order.parts_requests.some(r=>!['received','usage_recorded','resolved','rejected'].includes(r.status)))fail('OPEN_PARTS_REQUEST');
    if(payload.part_usages!==undefined){
     if(payload.usage_confirmed!==true)fail('USAGE_CONFIRMATION_REQUIRED');
     const pending=order.parts_requests.filter(r=>r.status==='received');const usages=payload.part_usages;
     if(!Array.isArray(usages)||usages.length!==pending.length||new Set(usages.map(u=>u&&u.request_id)).size!==usages.length||usages.some(u=>!u||!pending.some(r=>r.id===u.request_id)))fail('INVALID_USAGE_SET');
     for(const usage of usages)recordUsage(pending.find(r=>r.id===usage.request_id),usage.used_qty,'Số thực dùng / giao khách được thợ xác nhận khi nghiệm thu');
    }
    if(order.parts_requests.some(r=>r.status==='received'))fail('MATERIAL_USAGE_REQUIRED');
    const visit=order.visits.at(-1);const currentEvidence=order.evidence.filter(e=>e.actor_id===actor.id&&e.visit_id===visit.id);
    if(!currentEvidence.some(e=>e.kind==='after')||!currentEvidence.some(e=>e.kind==='handover'))fail('EVIDENCE_REQUIRED');
    if(payload.completion_checks!==undefined){
     const checks={delivered:'Đã giao hàng / máy',installed:'Đã lắp đặt / cài đặt',repaired:'Đã sửa chữa / thay thế',cleaned:'Đã vệ sinh / bảo dưỡng',tested:'Đã kiểm tra / chạy thử',guided:'Đã hướng dẫn khách sử dụng'};
     if(!Array.isArray(payload.completion_checks)||!payload.completion_checks.length||new Set(payload.completion_checks).size!==payload.completion_checks.length||payload.completion_checks.some(key=>!Object.hasOwn(checks,key))||payload.customer_accepted!==true)fail('INVALID_COMPLETION');
     const note=typeof payload.work_summary==='string'?payload.work_summary.trim():'';
     order.completion_checks=clone(payload.completion_checks);order.customer_acceptance={confirmed:true,at,actor_id:actor.id};order.work_summary=payload.completion_checks.map(key=>checks[key]).join('; ')+'; Khách xác nhận nghiệm thu'+(note?' · '+note:'');
    }else order.work_summary=required(payload.work_summary);
    order.status='accepted_work';order.accepted_at=at;visit.ended_at=at;visit.result='accepted';order.dossier_status='awaiting_reconciliation';break;
   }
   case 'cancel':if((order.parts_requests.some(r=>r.issue_no)||(order.collected_machines||[]).length)&&!permitted(actor,['director']))fail('DIRECTOR_APPROVAL_REQUIRED');requireState('new','assigned','accepted','scheduled','working','waiting_parts','unable');order.cancel_reason=required(payload.reason);order.status='cancelled';for(const visit of order.visits.filter(v=>!v.ended_at)){visit.ended_at=at;visit.result='cancelled';}break;
  }
  order.version++;order.updated_at=at;entity=order;
 }
 const result={id:entity.id,order_id:order?.id,order_no:order?.order_no,version:entity.version,status:order?.status,replayed:false};
 if(command.type==='create_customer'&&Object.values(state.customers).some(c=>c.phone.replace(/\D/g,'')===entity.phone.replace(/\D/g,'')))result.warning='DUPLICATE_PHONE';
 if(command.type==='add_evidence'){result.file_id=payload.file_id;result.upload_digest=payload.upload_digest;}
 next.events.push({id:fresh(),entity_id:entity.id,order_id:order?.id,type:command.type,actor_id:actor.id,actor_name:actor.name||actor.id,at,version:entity.version,reason:payload.note||payload.reason||''});next.commands[key]={fingerprint,result:clone(result)};return {state:next,result};
}
function project(state,actor,directory){
 if(!permitted(actor,['dispatcher','director','technician','warehouse']))fail('FORBIDDEN');
 const orders=Object.values(state.orders).filter(o=>canRead(actor,o));const ids=new Set(orders.map(o=>o.id));
 const canManage=permitted(actor,['dispatcher','director']);
 return {actor:{id:actor.id,name:actor.name,roles:actor.roles},orders:clone(orders),customers:canManage?clone(Object.values(state.customers)):[],machines:canManage?clone(Object.values(state.machines)):[],technicians:Object.values(directory).filter(p=>p.active!==false&&p.roles.includes('technician')).map(p=>({id:p.id,name:p.name,area:p.area||'',open_count:canManage||p.id===actor.id?orders.filter(o=>o.technician_id===p.id&&!['accepted_work','cancelled'].includes(o.status)).length:null})),events:clone(state.events.filter(e=>canManage||ids.has(e.order_id)))};
}
module.exports={emptyState,execute,project,canRead};
