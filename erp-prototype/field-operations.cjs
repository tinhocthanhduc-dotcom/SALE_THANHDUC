'use strict';
// Fixture domain only. Actors must come from a trusted server when used in staging.
const roles={
  issue_technician_stock:['warehouse','admin'],
  consume_technician_stock:['technician','admin'],
  request_stock_return:['technician','admin'],
  confirm_stock_return:['warehouse','admin'],
  report_payment:['sales','technician','admin'],
  confirm_payment:['finance','admin'],
  request_cash_handover:['sales','technician','admin'],
  confirm_cash_handover:['finance','admin']
};
function fail(code){const error=new Error(code);error.code=code;throw error;}
function text(value){if(typeof value!=='string'||!value.trim())fail('REQUIRED_FIELD');return value.trim();}
function positive(value){if(!Number.isSafeInteger(value)||value<=0)fail('INVALID_QUANTITY_OR_AMOUNT');return value;}
function sum(values){return values.reduce((a,b)=>{const n=a+b;if(!Number.isSafeInteger(n))fail('AMOUNT_OVERFLOW');return n;},0);}
function store(state){return state.field_operations||{payments:{},handovers:{},stock_movements:[],stock_returns:{},warehouse_balances:{}};}
function stockBalance(state,orderId,lineId){
  return sum(store(state).stock_movements.filter(m=>m.order_id===orderId&&m.line_id===lineId).map(m=>m.type==='issue'?m.qty:-m.qty));
}
function reservedReturn(state,orderId,lineId){return sum(Object.values(store(state).stock_returns).filter(r=>r.order_id===orderId&&r.line_id===lineId&&r.status==='proposed').map(r=>r.qty));}
function paymentSummary(state,orderId){
  const payments=Object.values(store(state).payments).filter(p=>p.order_id===orderId);
  const confirmed=sum(payments.filter(p=>p.status==='confirmed').map(p=>p.amount_vnd));
  const pending=sum(payments.filter(p=>p.status==='reported').map(p=>p.amount_vnd));
  const order=state.orders[orderId];if(!order)fail('UNKNOWN_ORDER');
  return {confirmed_vnd:confirmed,pending_vnd:pending,remaining_vnd:order.total_vnd-confirmed,status:confirmed===0?'unpaid':confirmed===order.total_vnd?'paid':'partial'};
}
function handoverAllocation(state,paymentId,status){return sum(Object.values(store(state).handovers).filter(h=>!status||h.status===status).flatMap(h=>h.allocations.filter(a=>a.payment_id===paymentId).map(a=>a.amount_vnd)));}
function custodySummary(state,collectorId){
  const ledger=store(state),payments=Object.values(ledger.payments).filter(p=>p.method==='cash'&&p.collected_by===collectorId);
  const reported=sum(payments.filter(p=>p.status==='reported').map(p=>p.amount_vnd));
  const confirmed=sum(payments.filter(p=>p.status==='confirmed').map(p=>p.amount_vnd));
  const handovers=Object.values(ledger.handovers).filter(h=>h.collected_by===collectorId);
  const deposited=sum(handovers.filter(h=>h.status==='confirmed').map(h=>h.amount_vnd));
  const pending=sum(handovers.filter(h=>h.status==='proposed').map(h=>h.amount_vnd));
  return {reported_cash_vnd:reported,confirmed_cash_vnd:confirmed,deposited_vnd:deposited,pending_handover_vnd:pending,held_confirmed_vnd:confirmed-deposited,available_handover_vnd:confirmed-deposited-pending};
}
function apply(state,order,command,context){
  const {actor,masters,now,id}=context,p=command.payload||{},type=command.type;
  if(actor.role==='technician'&&order.assignee_id!==actor.id)fail('FORBIDDEN');
  const receiptOperation=['confirm_payment','request_cash_handover','confirm_cash_handover','confirm_stock_return'].includes(type);
  if(!receiptOperation&&(order.reversal||['draft','cancelled','reversal_approved'].includes(order.status)))fail('INVALID_TRANSITION');
  state.field_operations=store(state);const ledger=state.field_operations;
  let operationId;
  const freshId=()=>{const value=text(id());if(ledger.payments[value]||ledger.handovers[value]||ledger.stock_returns[value]||ledger.stock_movements.some(m=>m.id===value))fail('DUPLICATE_ID');return value;};
  const movement=(kind,lineId,qty)=>{operationId=freshId();ledger.stock_movements.push({id:operationId,type:kind,order_id:order.id,line_id:lineId,technician_id:order.assignee_id,qty,actor_id:actor.id,at:now(),reference:text(p.reference)});};
  switch(type){
    case 'issue_technician_stock':
    case 'consume_technician_stock':
    case 'request_stock_return':{
      const line=order.lines.find(l=>l.id===p.line_id);if(!line)fail('UNKNOWN_ORDER_LINE');
      if(masters.products[line.product_id]?.kind!=='physical')fail('PHYSICAL_PRODUCT_REQUIRED');
      if(!masters.employees[order.assignee_id]?.active)fail('UNKNOWN_TECHNICIAN');
      const qty=positive(p.qty);text(p.reference);
      if(type==='issue_technician_stock'){
        const issued=sum(ledger.stock_movements.filter(m=>m.order_id===order.id&&m.line_id===line.id&&m.type==='issue').map(m=>m.qty));
        // Initial scope: no reissue or replacement after a return; a new line/workflow is required.
        if(issued+qty>line.qty)fail('ORDER_QUANTITY_EXCEEDED');
        if(!Object.hasOwn(ledger.warehouse_balances,line.product_id)){
          const opening=masters.fixture_warehouse_stock?.[line.product_id];
          if(!Number.isSafeInteger(opening)||opening<0)fail('UNKNOWN_WAREHOUSE_BALANCE');
          ledger.warehouse_balances[line.product_id]=opening;
        }
        if(ledger.warehouse_balances[line.product_id]<qty)fail('INSUFFICIENT_WAREHOUSE_STOCK');
        ledger.warehouse_balances[line.product_id]-=qty;
        movement('issue',line.id,qty);order.dispatched=true;order.dispatch_ref=text(p.reference);
      }else{
        if(stockBalance(state,order.id,line.id)-reservedReturn(state,order.id,line.id)<qty)fail('INSUFFICIENT_TECHNICIAN_STOCK');
        if(type==='consume_technician_stock'){
          if(!['doing','testing'].includes(order.work_status))fail('INVALID_TRANSITION');
          movement('consume',line.id,qty);
        }else{
          operationId=freshId();ledger.stock_returns[operationId]={id:operationId,order_id:order.id,line_id:line.id,product_id:line.product_id,technician_id:order.assignee_id,qty,status:'proposed',requested_by:actor.id,reference:text(p.reference),at:now()};
        }
      }
      break;
    }
    case 'confirm_stock_return':{
      const r=ledger.stock_returns[p.return_id];if(!r||r.order_id!==order.id)fail('UNKNOWN_STOCK_RETURN');
      if(r.status!=='proposed')fail('INVALID_TRANSITION');
      if(r.requested_by===actor.id)fail('SELF_APPROVAL_FORBIDDEN');
      if(stockBalance(state,order.id,r.line_id)<r.qty)fail('INSUFFICIENT_TECHNICIAN_STOCK');
      if(!Number.isSafeInteger(ledger.warehouse_balances[r.product_id]))fail('UNKNOWN_WAREHOUSE_BALANCE');
      r.evidence=text(p.evidence);r.status='confirmed';r.confirmed_by=actor.id;r.confirmed_at=now();
      ledger.warehouse_balances[r.product_id]=sum([ledger.warehouse_balances[r.product_id],r.qty]);
      movement('return',r.line_id,r.qty);operationId=r.id;break;
    }
    case 'report_payment':{
      const amount=positive(p.amount_vnd),summary=paymentSummary(state,order.id);
      if(sum([summary.confirmed_vnd,summary.pending_vnd,amount])>order.total_vnd)fail('PAYMENT_EXCEEDS_ORDER');
      if(!['cash','bank','pos'].includes(p.method))fail('INVALID_PAYMENT_METHOD');
      const reference=text(p.reference);
      if(Object.values(ledger.payments).some(r=>r.method===p.method&&r.reference===reference))fail('DUPLICATE_PAYMENT_REFERENCE');
      operationId=freshId();ledger.payments[operationId]={id:operationId,order_id:order.id,customer_id:order.customer_id,amount_vnd:amount,method:p.method,reference,collected_by:actor.id,status:'reported',at:now()};break;
    }
    case 'confirm_payment':{
      const payment=ledger.payments[p.payment_id];if(!payment||payment.order_id!==order.id)fail('UNKNOWN_PAYMENT');
      if(payment.status!=='reported')fail('INVALID_TRANSITION');
      if(payment.collected_by===actor.id)fail('SELF_APPROVAL_FORBIDDEN');
      payment.evidence=text(p.evidence);payment.status='confirmed';payment.confirmed_by=actor.id;payment.confirmed_at=now();
      order.payment_status=paymentSummary(state,order.id).status;operationId=payment.id;break;
    }
    case 'request_cash_handover':{
      if(!Array.isArray(p.allocations)||!p.allocations.length)fail('EMPTY_ALLOCATION');
      const seen=new Set();const allocations=p.allocations.map(a=>{
        const payment=ledger.payments[a.payment_id];if(!payment||payment.order_id!==order.id)fail('UNKNOWN_PAYMENT');
        if(payment.method!=='cash'||payment.status!=='confirmed')fail('CONFIRMED_CASH_REQUIRED');
        if(payment.collected_by!==actor.id)fail('FORBIDDEN');
        if(seen.has(a.payment_id))fail('DUPLICATE_ALLOCATION');seen.add(a.payment_id);
        const amount=positive(a.amount_vnd);
        if(sum([handoverAllocation(state,a.payment_id),amount])>payment.amount_vnd)fail('HANDOVER_EXCEEDS_CASH');
        return {payment_id:a.payment_id,amount_vnd:amount};
      });
      const reference=text(p.reference);
      if(Object.values(ledger.handovers).some(h=>h.reference===reference))fail('DUPLICATE_HANDOVER_REFERENCE');
      operationId=freshId();ledger.handovers[operationId]={id:operationId,order_id:order.id,collected_by:actor.id,allocations,amount_vnd:sum(allocations.map(a=>a.amount_vnd)),reference,status:'proposed',at:now()};break;
    }
    case 'confirm_cash_handover':{
      const handover=ledger.handovers[p.handover_id];if(!handover||handover.order_id!==order.id)fail('UNKNOWN_HANDOVER');
      if(handover.status!=='proposed')fail('INVALID_TRANSITION');
      if(handover.collected_by===actor.id)fail('SELF_APPROVAL_FORBIDDEN');
      handover.evidence=text(p.evidence);handover.status='confirmed';handover.confirmed_by=actor.id;handover.confirmed_at=now();operationId=handover.id;break;
    }
  }
  return operationId;
}
module.exports={roles,apply,stockBalance,paymentSummary,custodySummary,store};
