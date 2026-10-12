'use strict';
// Pure domain simulation. No persistent storage, Sheets access or production endpoints.
const Field=require('./field-operations.cjs');
function fail(code){const e=new Error(code);e.code=code;throw e;}
const clone=v=>JSON.parse(JSON.stringify(v));
function canonical(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';}
function emptyState(){return {orders:{},commands:{},events:[],sequences:{}};}
function businessDate(iso){const d=new Date(iso);if(!Number.isFinite(d.getTime()))fail('INVALID_CLOCK');return new Date(d.getTime()+7*60*60*1000).toISOString().slice(0,10).replace(/-/g,'');}
function requireRole(actor,roles){if(!actor||!actor.id||!roles.includes(actor.role))fail('FORBIDDEN');}
function requiredText(v){if(typeof v!=='string'||!v.trim())fail('REQUIRED_FIELD');return v.trim();}
// actor is trusted server context; payload.actor_id is never used.
function execute(state,command,{actor,masters,now,id}) {
  if(!command||(!Object.hasOwn(Field.roles,command.type)&&!['create','confirm','assign','start','test','complete','request_revenue','approve_revenue','record_dispatch','cancel','request_reversal','approve_reversal'].includes(command.type)))fail('UNKNOWN_COMMAND');
  const roles={create:['sales','admin'],confirm:['sales','admin'],assign:['manager','admin'],start:['technician','admin'],test:['technician','admin'],complete:['technician','admin'],request_revenue:['sales','manager','admin'],approve_revenue:['finance','admin'],record_dispatch:['warehouse','admin'],cancel:['sales','manager','admin'],request_reversal:['sales','manager','admin'],approve_reversal:['manager','admin']};
  requireRole(actor,roles[command.type]||Field.roles[command.type]);
  const key=actor.id+':'+requiredText(command.idempotency_key);
  const payload=command.payload||{};
  const fingerprint=canonical({type:command.type,payload,expected_version:command.expected_version});
  const previous=state.commands[key];
  if(previous){if(previous.fingerprint!==fingerprint)fail('IDEMPOTENCY_CONFLICT');return {state:clone(state),result:{...clone(previous.result),replayed:true}};}
  const next=clone(state);next.sequences=next.sequences||{};let order,operationId;
  if(command.type==='create') {
    const customer=masters.customers[payload.customer_id];
    if(!customer||!customer.active)fail('UNKNOWN_CUSTOMER');
    if(!Array.isArray(payload.lines)||!payload.lines.length)fail('EMPTY_ORDER');
    const lines=payload.lines.map(line=>{
      const product=masters.products[line.product_id];
      if(!product||!product.active||!product.approved)fail('UNAPPROVED_PRODUCT');
      if(!Number.isSafeInteger(line.qty)||line.qty<=0||!Number.isSafeInteger(line.unit_price_vnd)||line.unit_price_vnd<0)fail('INVALID_LINE');
      if(!Number.isSafeInteger(line.qty*line.unit_price_vnd))fail('AMOUNT_OVERFLOW');
      return {id:id(),product_id:line.product_id,qty:line.qty,unit_price_vnd:line.unit_price_vnd,name:product.name,unit:product.unit};
    });
    const total=lines.reduce((a,l)=>a+l.qty*l.unit_price_vnd,0);if(!Number.isSafeInteger(total))fail('AMOUNT_OVERFLOW');
    // VND agreed gross total only; VAT decomposition intentionally deferred.
    const day=businessDate(now());const sequence=(next.sequences[day]||0)+1;if(!Number.isSafeInteger(sequence))fail('SEQUENCE_OVERFLOW');next.sequences[day]=sequence;
    const orderNo='TD-'+day+'-'+String(sequence).padStart(4,'0');
    order={id:id(),order_no:orderNo,dispatched:false,customer_id:payload.customer_id,lines,total_vnd:total,status:'draft',work_status:'queued',revenue_status:'none',payment_status:'unpaid',version:1};
    if(next.orders[order.id])fail('DUPLICATE_ID');next.orders[order.id]=order;
  } else {
    order=next.orders[payload.order_id];if(!order)fail('UNKNOWN_ORDER');
    if(command.expected_version!==order.version)fail('VERSION_CONFLICT');
    if(['start','test','complete'].includes(command.type)&&actor.role==='technician'&&order.assignee_id!==actor.id)fail('FORBIDDEN');
    const check=(status,work)=>{if(order.status!==status||(work&&order.work_status!==work))fail('INVALID_TRANSITION');};
    if(Object.hasOwn(Field.roles,command.type))operationId=Field.apply(next,order,command,{actor,masters,now,id});
    else switch(command.type){
      case 'confirm':check('draft');order.status='confirmed';break;
      case 'assign':check('confirmed','queued');if(!masters.employees[payload.assignee_id]?.active||masters.employees[payload.assignee_id].role!=='technician')fail('UNKNOWN_TECHNICIAN');order.assignee_id=payload.assignee_id;order.work_status='assigned';break;
      case 'start':if(order.reversal)fail('INVALID_TRANSITION');check('confirmed','assigned');order.status='in_progress';order.work_status='doing';break;
      case 'test':if(order.reversal)fail('INVALID_TRANSITION');check('in_progress','doing');order.test_result=requiredText(payload.test_result);order.work_status='testing';break;
      case 'complete':if(order.reversal)fail('INVALID_TRANSITION');check('in_progress','testing');order.handover_evidence=requiredText(payload.handover_evidence);order.work_status='completed';order.status='fulfilled';order.completed_at=now();break;
      case 'request_revenue':if(order.reversal)fail('INVALID_TRANSITION');check('fulfilled','completed');if(order.revenue_status!=='none')fail('INVALID_TRANSITION');order.revenue_status='proposed';break;
      case 'approve_revenue':check('fulfilled','completed');if(order.revenue_status!=='proposed'||order.reversal)fail('INVALID_TRANSITION');order.revenue_status='approved';order.revenue_approved_by=actor.id;break;
      case 'record_dispatch':if(!['confirmed','in_progress','fulfilled'].includes(order.status)||order.dispatched||order.reversal)fail('INVALID_TRANSITION');order.dispatch_ref=requiredText(payload.dispatch_ref);order.dispatched=true;break;
      case 'cancel':if(Object.values(Field.store(next).payments).some(p=>p.order_id===order.id))fail('REVERSAL_REQUIRED');if(['cancelled','reversal_approved'].includes(order.status))fail('INVALID_TRANSITION');if(order.dispatched||order.revenue_status!=='none')fail('REVERSAL_REQUIRED');order.cancel_reason=requiredText(payload.reason);order.status='cancelled';order.work_status='cancelled';break;
      case 'request_reversal':if(!order.dispatched&&order.revenue_status==='none'&&!Object.values(Field.store(next).payments).some(p=>p.order_id===order.id))fail('CANCELLATION_AVAILABLE');if(order.reversal||['cancelled','reversal_approved'].includes(order.status))fail('INVALID_TRANSITION');order.reversal={id:id(),status:'proposed',reason:requiredText(payload.reason),requested_by:actor.id,original_order_id:order.id};break;
      case 'approve_reversal':if(order.reversal?.status!=='proposed')fail('INVALID_TRANSITION');if(order.reversal.requested_by===actor.id)fail('SELF_APPROVAL_FORBIDDEN');order.reversal.approval_evidence=requiredText(payload.approval_evidence);order.reversal.status='approved';order.reversal.approved_by=actor.id;order.status='reversal_approved';break;
    }
    order.version++;
  }
  const result={order_id:order.id,order_no:order.order_no,version:order.version,status:order.status,work_status:order.work_status,revenue_status:order.revenue_status,payment_status:order.payment_status,replayed:false};
  if(operationId)result.operation_id=operationId;
  next.events.push({operation_id:operationId,id:id(),order_id:order.id,type:command.type,actor_id:actor.id,at:now(),version:order.version});
  next.commands[key]={fingerprint,result:clone(result)};
  return {state:next,result};
}
module.exports={emptyState,execute,businessDate,stockBalance:Field.stockBalance,paymentSummary:Field.paymentSummary,custodySummary:Field.custodySummary};
