'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Domain=require('../order-work.cjs');
const {LocalRepository}=require('../local-repository.cjs');
function fixture(){
  let state=Domain.emptyState(),seq=0;
  const context={masters:{customers:{c:{active:true}},products:{p:{active:true,approved:true,kind:'physical',name:'Mực mẫu',unit:'Hộp'},s:{active:true,approved:true,kind:'service',name:'Công mẫu',unit:'Lần'}},employees:{t:{active:true,role:'technician'}},fixture_warehouse_stock:{p:10}},now:()=> '2026-10-12T10:00:00Z',id:()=> 'field-'+(++seq)};
  const run=(type,payload={},role='sales',actorId=role,options={})=>{
    const cmd={type,payload,idempotency_key:'key-'+(++seq),expected_version:payload.order_id?state.orders[payload.order_id].version:undefined,...options};
    const out=Domain.execute(state,cmd,{...context,actor:{id:actorId,role}});state=out.state;return out.result;
  };
  const order=run('create',{customer_id:'c',lines:[{product_id:'p',qty:3,unit_price_vnd:100000},{product_id:'s',qty:1,unit_price_vnd:100000}]}).order_id;
  run('confirm',{order_id:order});run('assign',{order_id:order,assignee_id:'t'},'manager');
  return {run,order,context,get state(){return state;},get line(){return state.orders[order].lines[0].id;}};
}
test('technician stock transfer, consumption and confirmed return conserve warehouse stock',()=>{
  const h=fixture(),p={order_id:h.order,line_id:h.line};
  h.run('issue_technician_stock',{...p,qty:3,reference:'X1'},'warehouse');
  assert.equal(h.state.field_operations.warehouse_balances.p,7);
  h.run('receive_technician_stock',{order_id:h.order,issue_id:h.state.field_operations.stock_movements.at(-1).id,evidence:'Đã nhận'},'technician','t');
  h.run('start',{order_id:h.order},'technician','t');
  h.run('consume_technician_stock',{...p,qty:2,reference:'Used'},'technician','t');
  const r=h.run('request_stock_return',{...p,qty:1,reference:'R1'},'technician','t');
  assert.equal(Domain.stockBalance(h.state,h.order,h.line),1);
  assert.equal(h.state.field_operations.warehouse_balances.p,7);
  h.run('confirm_stock_return',{order_id:h.order,return_id:r.operation_id,evidence:'Kho nhận đủ',reference:'RN1'},'warehouse');
  assert.equal(Domain.stockBalance(h.state,h.order,h.line),0);
  assert.equal(h.state.field_operations.warehouse_balances.p,8);
  assert.equal(h.state.orders[h.order].dispatched,true);
});
test('unknown warehouse balance, excessive issue, services and foreign technician reject atomically',()=>{
  const h=fixture(),p={order_id:h.order,line_id:h.line,qty:1,reference:'X'};
  delete h.context.masters.fixture_warehouse_stock.p;
  const before=JSON.stringify(h.state);
  assert.throws(()=>h.run('issue_technician_stock',p,'warehouse'),/UNKNOWN_WAREHOUSE_BALANCE/);
  assert.equal(JSON.stringify(h.state),before);
  h.context.masters.fixture_warehouse_stock.p=10;
  assert.throws(()=>h.run('issue_technician_stock',{...p,qty:4},'warehouse'),/ORDER_QUANTITY_EXCEEDED/);
  assert.throws(()=>h.run('issue_technician_stock',{...p,line_id:h.state.orders[h.order].lines[1].id},'warehouse'),/PHYSICAL_PRODUCT_REQUIRED/);
  assert.throws(()=>h.run('request_stock_return',p,'technician','other'),/FORBIDDEN/);
});
test('pending stock return reserves quantity and replay cannot return twice',()=>{
  const h=fixture(),p={order_id:h.order,line_id:h.line,qty:3,reference:'X'};
  h.run('issue_technician_stock',p,'warehouse');h.run('receive_technician_stock',{order_id:h.order,issue_id:h.state.field_operations.stock_movements.at(-1).id,evidence:'Đã nhận'},'technician','t');h.run('start',{order_id:h.order},'technician','t');
  h.run('request_stock_return',p,'technician','t');
  assert.throws(()=>h.run('consume_technician_stock',{...p,qty:1},'technician','t'),/INSUFFICIENT_TECHNICIAN_STOCK/);
  assert.throws(()=>h.run('request_stock_return',{...p,qty:1},'technician','t'),/INSUFFICIENT_TECHNICIAN_STOCK/);
  const r=Object.values(h.state.field_operations.stock_returns)[0];
  const payload={order_id:h.order,return_id:r.id,evidence:'Received',reference:'RN'};
  const v=h.state.orders[h.order].version;
  h.run('confirm_stock_return',payload,'warehouse','warehouse',{expected_version:v,idempotency_key:'return'});
  const replay=h.run('confirm_stock_return',payload,'warehouse','warehouse',{expected_version:v,idempotency_key:'return'});
  assert.equal(replay.replayed,true);assert.equal(h.state.field_operations.warehouse_balances.p,10);
});
test('reported cash is distinct from confirmed payment and revenue',()=>{
  const h=fixture(),p=h.run('report_payment',{order_id:h.order,amount_vnd:150000,method:'cash',reference:'P1'},'technician','t');
  assert.equal(h.state.orders[h.order].payment_status,'unpaid');
  assert.deepEqual(Domain.paymentSummary(h.state,h.order),{confirmed_vnd:0,pending_vnd:150000,remaining_vnd:400000,status:'unpaid'});
  assert.equal(Domain.custodySummary(h.state,'t').reported_cash_vnd,150000);
  h.run('confirm_payment',{order_id:h.order,payment_id:p.operation_id,evidence:'Biên nhận'},'finance');
  assert.equal(Domain.paymentSummary(h.state,h.order).remaining_vnd,250000);
  assert.equal(h.state.orders[h.order].payment_status,'partial');
  assert.equal(h.state.orders[h.order].revenue_status,'none');
});
test('cash handover changes custody only after independent Finance confirmation',()=>{
  const h=fixture(),p=h.run('report_payment',{order_id:h.order,amount_vnd:400000,method:'cash',reference:'P1'},'technician','t');
  h.run('confirm_payment',{order_id:h.order,payment_id:p.operation_id,evidence:'Receipt'},'finance');
  const d=h.run('request_cash_handover',{order_id:h.order,allocations:[{payment_id:p.operation_id,amount_vnd:250000}],reference:'D1'},'technician','t');
  assert.equal(Domain.custodySummary(h.state,'t').held_confirmed_vnd,400000);
  assert.equal(Domain.custodySummary(h.state,'t').available_handover_vnd,150000);
  assert.throws(()=>h.run('confirm_cash_handover',{order_id:h.order,handover_id:d.operation_id,evidence:'Received'},'admin','t'),/SELF_APPROVAL_FORBIDDEN/);
  h.run('confirm_cash_handover',{order_id:h.order,handover_id:d.operation_id,evidence:'Quỹ đã nhận'},'finance');
  assert.equal(Domain.custodySummary(h.state,'t').held_confirmed_vnd,150000);
  assert.equal(Domain.paymentSummary(h.state,h.order).remaining_vnd,0);
  assert.equal(h.state.orders[h.order].payment_status,'paid');
});
test('pending and duplicate payments cannot overallocate or bypass cancellation safeguards',()=>{
  const h=fixture();h.run('report_payment',{order_id:h.order,amount_vnd:300000,method:'bank',reference:'P1'});
  assert.throws(()=>h.run('report_payment',{order_id:h.order,amount_vnd:100001,method:'bank',reference:'P2'}),/PAYMENT_EXCEEDS_ORDER/);
  assert.throws(()=>h.run('report_payment',{order_id:h.order,amount_vnd:1,method:'bank',reference:'P1'}),/DUPLICATE_PAYMENT_REFERENCE/);
  assert.throws(()=>h.run('cancel',{order_id:h.order,reason:'Cancel'}),/REVERSAL_REQUIRED/);
  assert.equal(h.state.orders[h.order].status,'confirmed');
});
test('no cash handover from unconfirmed, bank, foreign or overallocated payments',()=>{
  const h=fixture();
  const p=h.run('report_payment',{order_id:h.order,amount_vnd:200000,method:'cash',reference:'P1'});
  const payload={order_id:h.order,allocations:[{payment_id:p.operation_id,amount_vnd:100000}],reference:'D1'};
  assert.throws(()=>h.run('request_cash_handover',payload),/CONFIRMED_CASH_REQUIRED/);
  h.run('confirm_payment',{order_id:h.order,payment_id:p.operation_id,evidence:'Receipt'},'finance');
  assert.throws(()=>h.run('request_cash_handover',payload,'technician','t'),/FORBIDDEN/);
  h.run('request_cash_handover',payload);
  assert.throws(()=>h.run('request_cash_handover',{...payload,reference:'D2',allocations:[{payment_id:p.operation_id,amount_vnd:100001}]}),/HANDOVER_EXCEEDS_CASH/);
  assert.throws(()=>h.run('request_cash_handover',{...payload,reference:'D3',allocations:[...payload.allocations,...payload.allocations]}),/DUPLICATE_ALLOCATION/);
  const bank=h.run('report_payment',{order_id:h.order,amount_vnd:100000,method:'bank',reference:'B1'});
  h.run('confirm_payment',{order_id:h.order,payment_id:bank.operation_id,evidence:'Bank'},'finance');
  assert.throws(()=>h.run('request_cash_handover',{...payload,allocations:[{payment_id:bank.operation_id,amount_vnd:1}]}),/CONFIRMED_CASH_REQUIRED/);
});
test('receipt role guards, required evidence, stale version and replay preserve state',()=>{
  const h=fixture(),payload={order_id:h.order,amount_vnd:200000,method:'cash',reference:'P1'};
  const v=h.state.orders[h.order].version;
  const r=h.run('report_payment',payload,'sales','sales',{expected_version:v,idempotency_key:'once'});
  const replay=h.run('report_payment',payload,'sales','sales',{expected_version:v,idempotency_key:'once'});
  assert.equal(replay.operation_id,r.operation_id);assert.equal(replay.replayed,true);
  const before=JSON.stringify(h.state),confirm={order_id:h.order,payment_id:r.operation_id,evidence:'Ok',actor_id:'finance'};
  assert.throws(()=>h.run('confirm_payment',confirm,'technician','t'),/FORBIDDEN/);
  assert.throws(()=>h.run('confirm_payment',confirm,'admin','sales'),/SELF_APPROVAL_FORBIDDEN/);
  assert.throws(()=>h.run('confirm_payment',{...confirm,evidence:''},'finance'),/REQUIRED_FIELD/);
  assert.throws(()=>h.run('confirm_payment',confirm,'finance','finance',{expected_version:v}),/VERSION_CONFLICT/);
  assert.equal(JSON.stringify(h.state),before);
});
test('reported payment survives local journal recovery without duplicating receipts',()=>{
  const h=fixture(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'erp-field-'));
  try{
    fs.writeFileSync(path.join(dir,'state.json'),JSON.stringify({revision:0,state:h.state}));
    const command={type:'report_payment',payload:{order_id:h.order,amount_vnd:100000,method:'cash',reference:'P1'},expected_version:h.state.orders[h.order].version,idempotency_key:'durable'};
    const context={...h.context,actor:{id:'t',role:'technician'}};
    const broken=new LocalRepository(dir,{fault:point=>{if(point==='after_prepare')throw Error('CRASH');}});
    assert.throws(()=>broken.submit(command,context),/CRASH/);
    const repository=new LocalRepository(dir),receipt=repository.submit(command,context);
    assert.equal(receipt.replayed,true);
    assert.equal(Object.keys(repository.snapshot().state.field_operations.payments).length,1);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('pickup is explicit: only assigned technician can acknowledge, before work starts',()=>{
 const h=fixture(),payload={order_id:h.order,line_id:h.line,qty:3,reference:'PX-TAKE'};
 assert.throws(()=>h.run('start',{order_id:h.order},'technician','t'),/STOCK_PICKUP_REQUIRED/);
 const issue=h.run('issue_technician_stock',payload,'warehouse');
 assert.equal(Domain.stockBalance(h.state,h.order,h.line),0);
 assert.equal(Domain.pendingPickup(h.state,h.order,h.line),3);
 assert.throws(()=>h.run('start',{order_id:h.order},'technician','t'),/STOCK_PICKUP_REQUIRED/);
 assert.throws(()=>h.run('request_stock_return',{...payload,qty:1},'technician','t'),/INSUFFICIENT_TECHNICIAN_STOCK/);
 const p={order_id:h.order,issue_id:issue.operation_id,evidence:'Đã nhận 3 hộp'};
 assert.throws(()=>h.run('receive_technician_stock',p,'technician','other'),/FORBIDDEN/);
 assert.throws(()=>h.run('receive_technician_stock',p,'warehouse'),/FORBIDDEN/);
 assert.throws(()=>h.run('receive_technician_stock',{...p,evidence:''},'technician','t'),/REQUIRED_FIELD/);
 const version=h.state.orders[h.order].version;
 h.run('receive_technician_stock',p,'technician','t',{expected_version:version,idempotency_key:'pickup'});
 assert.equal(Domain.stockBalance(h.state,h.order,h.line),3);
 assert.equal(Domain.pendingPickup(h.state,h.order,h.line),0);
 assert.equal(h.run('receive_technician_stock',p,'technician','t',{expected_version:version,idempotency_key:'pickup'}).replayed,true);
 assert.throws(()=>h.run('receive_technician_stock',p,'technician','t'),/INVALID_TRANSITION/);
 h.run('start',{order_id:h.order},'technician','t');
 assert.equal(h.state.orders[h.order].work_status,'doing');
});
test('partial issue and pickup cannot begin a visit missing physical order quantities',()=>{
 const h=fixture();const issue=h.run('issue_technician_stock',{order_id:h.order,line_id:h.line,qty:1,reference:'PX-PART'},'warehouse');
 h.run('receive_technician_stock',{order_id:h.order,issue_id:issue.operation_id,evidence:'Received 1'},'technician','t');
 assert.throws(()=>h.run('start',{order_id:h.order},'technician','t'),/STOCK_PICKUP_REQUIRED/);
 const rest=h.run('issue_technician_stock',{order_id:h.order,line_id:h.line,qty:2,reference:'PX-REST'},'warehouse');
 h.run('receive_technician_stock',{order_id:h.order,issue_id:rest.operation_id,evidence:'Received 2'},'technician','t');
 h.run('start',{order_id:h.order},'technician','t');
});
