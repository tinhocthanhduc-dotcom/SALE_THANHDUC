'use strict';
// Pure domain simulation. No persistent storage, Sheets access or production endpoints.
function fail(code){const e=new Error(code);e.code=code;throw e;}
const clone=v=>JSON.parse(JSON.stringify(v));
function canonical(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';}
function emptyState(){return {orders:{},commands:{},events:[]};}
function requireRole(actor,roles){if(!actor||!actor.id||!roles.includes(actor.role))fail('FORBIDDEN');}
function requiredText(v){if(typeof v!=='string'||!v.trim())fail('REQUIRED_FIELD');return v.trim();}
// actor is trusted server context; payload.actor_id is never used.
function execute(state,command,{actor,masters,now,id}) {
  if(!command||!['create','confirm','assign','start','test','complete','request_revenue','approve_revenue'].includes(command.type))fail('UNKNOWN_COMMAND');
  const roles={create:['sales','admin'],confirm:['sales','admin'],assign:['manager','admin'],start:['technician','admin'],test:['technician','admin'],complete:['technician','admin'],request_revenue:['sales','manager','admin'],approve_revenue:['finance','admin']};
  requireRole(actor,roles[command.type]);
  const key=actor.id+':'+requiredText(command.idempotency_key);
  const payload=command.payload||{};
  const fingerprint=canonical({type:command.type,payload,expected_version:command.expected_version});
  const previous=state.commands[key];
  if(previous){if(previous.fingerprint!==fingerprint)fail('IDEMPOTENCY_CONFLICT');return {state:clone(state),result:{...clone(previous.result),replayed:true}};}
  const next=clone(state);let order;
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
    order={id:id(),customer_id:payload.customer_id,lines,total_vnd:total,status:'draft',work_status:'queued',revenue_status:'none',payment_status:'unpaid',version:1};
    if(next.orders[order.id])fail('DUPLICATE_ID');next.orders[order.id]=order;
  } else {
    order=next.orders[payload.order_id];if(!order)fail('UNKNOWN_ORDER');
    if(command.expected_version!==order.version)fail('VERSION_CONFLICT');
    if(['start','test','complete'].includes(command.type)&&actor.role==='technician'&&order.assignee_id!==actor.id)fail('FORBIDDEN');
    const check=(status,work)=>{if(order.status!==status||(work&&order.work_status!==work))fail('INVALID_TRANSITION');};
    switch(command.type){
      case 'confirm':check('draft');order.status='confirmed';break;
      case 'assign':check('confirmed','queued');if(!masters.employees[payload.assignee_id]?.active||masters.employees[payload.assignee_id].role!=='technician')fail('UNKNOWN_TECHNICIAN');order.assignee_id=payload.assignee_id;order.work_status='assigned';break;
      case 'start':check('confirmed','assigned');order.status='in_progress';order.work_status='doing';break;
      case 'test':check('in_progress','doing');order.test_result=requiredText(payload.test_result);order.work_status='testing';break;
      case 'complete':check('in_progress','testing');order.handover_evidence=requiredText(payload.handover_evidence);order.work_status='completed';order.status='fulfilled';order.completed_at=now();break;
      case 'request_revenue':check('fulfilled','completed');if(order.revenue_status!=='none')fail('INVALID_TRANSITION');order.revenue_status='proposed';break;
      case 'approve_revenue':check('fulfilled','completed');if(order.revenue_status!=='proposed')fail('INVALID_TRANSITION');order.revenue_status='approved';order.revenue_approved_by=actor.id;break;
    }
    order.version++;
  }
  const result={order_id:order.id,version:order.version,status:order.status,work_status:order.work_status,revenue_status:order.revenue_status,payment_status:order.payment_status,replayed:false};
  next.events.push({id:id(),order_id:order.id,type:command.type,actor_id:actor.id,at:now(),version:order.version});
  next.commands[key]={fingerprint,result:clone(result)};
  return {state:next,result};
}
module.exports={emptyState,execute};
