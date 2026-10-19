'use strict';
const clone=v=>JSON.parse(JSON.stringify(v)),Money=()=>require('./money.cjs');
function fail(code){const e=new Error(code);e.code=code;throw e;}
const roles={request_cash_correction:['technician','finance'],approve_cash_correction:['director'],reject_cash_correction:['director'],cancel_deposit:['technician','finance','director']};
const open=c=>['pending','syncing'].includes(c.status);
function pending(s,orderId){return Object.values(s.cash_corrections||{}).filter(c=>open(c)&&(!orderId||c.order_id===orderId));}
function syncing(s,orderId){return pending(s,orderId).some(c=>c.status==='syncing');}
function eligible(s,r){if(!r||r.kind!=='cash')fail('CASH_ONLY');if(['replaced','rejected','awaiting_correction'].includes(r.status))fail('CASH_RECEIPT_REPLACED');const deposits=Object.values(s.deposits||{}).filter(d=>d.status!=='cancelled'&&d.allocations.some(a=>a.payment_id===r.id));if(deposits.some(d=>d.status!=='pending')||(r.deposited_amount||0)>0)fail('CASH_ALREADY_DEPOSITED');if(deposits.length)fail('CASH_CANCEL_PENDING_DEPOSIT');}
function checkIncrease(s,r,n){if(n>r.amount&&n-r.amount>Money().balance(s,s.orders[r.order_id]).collectable)fail('OVER_COLLECTION');}
function apply(s,c,{actor,at,fresh,number}){
 const p=c.payload||{},reason=()=>{if(typeof p.reason!=='string'||!p.reason.trim())fail('REQUIRED_FIELD');return p.reason.trim();},version=x=>{if(c.expected_version!==x.version)fail('VERSION_CONFLICT');},bump=o=>{o.version++;o.updated_at=at;};s.cash_corrections=s.cash_corrections||{};
 if(c.type==='cancel_deposit'){const d=s.deposits?.[p.deposit_id];if(!d)fail('UNKNOWN_DEPOSIT');version(d);if(d.actor_id!==actor.id&&!actor.roles.some(r=>['finance','director'].includes(r)))fail('FORBIDDEN');if(d.status!=='pending')fail('CASH_ALREADY_DEPOSITED');const note=reason();Object.assign(d,{status:'cancelled',cancelled_by:actor.id,cancelled_by_name:actor.name||actor.id,cancelled_at:at,cancel_reason:note,version:d.version+1});for(const id of new Set(d.allocations.map(a=>a.order_id)))bump(s.orders[id]);return {entity:d,details:{reason:note}};}
 if(c.type==='request_cash_correction'){
  const r=s.payments?.[p.payment_id],o=r&&s.orders[r.order_id];eligible(s,r);if(o.dossier_status==='closed')fail('DOSSIER_CLOSED');version(r);
  if(!actor.roles.includes('finance')&&!(actor.roles.includes('technician')&&o.technician_id===actor.id&&r.actor_id===actor.id))fail('FORBIDDEN');
  if(pending(s).some(x=>x.payment_id===r.id))fail('CASH_CORRECTION_EXISTS');const n=Money().amount(p.correct_amount);if(n===r.amount)fail('CASH_NO_CHANGE');checkIncrease(s,r,n);
  if(p.evidence_file_id&&!o.evidence.some(x=>x.file_id===p.evidence_file_id))fail('INVALID_EVIDENCE');
  const entity={id:fresh(),correction_no:number(s,'DC',at),payment_id:r.id,receipt_no:r.receipt_no,order_id:o.id,holder_id:r.actor_id,old_amount:r.amount,correct_amount:n,reason:reason(),evidence_file_id:p.evidence_file_id||'',status:'pending',version:1,requested_by:actor.id,requested_by_name:actor.name||actor.id,requested_at:at,source_payment_version:r.version};s.cash_corrections[entity.id]=entity;bump(o);return {entity,order:o,details:clone(entity)};
 }
 const dc=s.cash_corrections[p.correction_id];if(!dc)fail('UNKNOWN_CASH_CORRECTION');version(dc);if(dc.requested_by===actor.id)fail('SELF_CONFIRMATION');if(dc.status!=='pending')fail('INVALID_TRANSITION');const r=s.payments[dc.payment_id],o=s.orders[dc.order_id];
 if(c.type==='reject_cash_correction'){Object.assign(dc,{status:'rejected',decided_by:actor.id,decided_at:at,decision_reason:reason(),version:dc.version+1});bump(o);return {entity:dc,order:o,details:clone(dc)};}
 eligible(s,r);if(syncing(s,o.id))fail('CASH_CORRECTION_SYNCING');if(r.version!==dc.source_payment_version)fail('VERSION_CONFLICT');checkIncrease(s,r,dc.correct_amount);if(o.dossier_status==='closed')fail('DOSSIER_CLOSED');
 const i=s.integration,source=i?.outbox[r.finance_job_key||'DIEUPHOI:'+r.receipt_no];if(!i?.enabled||!source||!source.mapping_complete)fail('CASH_SOURCE_MAPPING_REQUIRED');if(source.status==='superseded')fail('CASH_RECEIPT_REPLACED');
 Object.assign(dc,{status:'syncing',approved_by:actor.id,approved_by_name:actor.name||actor.id,approved_at:at,version:dc.version+1,source_key:source.key,source_snapshot:clone(source),replacement_debt_allocations:require('./debt.cjs').allocate(s,o,dc.correct_amount,r.id),replacement_id:dc.correct_amount>0?fresh():null,replacement_receipt_no:dc.correct_amount>0?number(s,'PT',at):null});bump(o);return {entity:dc,order:o,details:clone(dc)};
}
function finish(s,dc,at){if(dc.status!=='syncing')return;const old=s.payments[dc.payment_id];eligible(s,old);old.status='replaced';old.replaced_by=dc.replacement_id;old.correction_id=dc.id;old.replaced_at=at;old.version++;
 if(dc.correct_amount>0){const r={...clone(old),id:dc.replacement_id,receipt_no:dc.replacement_receipt_no,at:dc.approved_at,status:'pending',version:1,amount:dc.correct_amount,debt_allocations:clone(dc.replacement_debt_allocations||[]),deposited_amount:0,correction_id:dc.id,replaces_payment_id:old.id,finance_job_key:'DIEUPHOI:DC:'+dc.correction_no+':THU'};delete r.replaced_by;delete r.replaced_at;delete r.confirmations;delete r.confirmed_at;delete r.confirmed_by;s.payments[r.id]=r;}
 dc.status='applied';dc.applied_at=at;dc.version++;s.orders[dc.order_id].version++;s.orders[dc.order_id].updated_at=at;
 s.events.push({id:'cash-correction:'+dc.id,entity_id:dc.id,order_id:dc.order_id,type:'cash_correction_applied',actor_id:dc.approved_by,actor_name:dc.approved_by_name||dc.approved_by,at,version:dc.version,details:{correction_no:dc.correction_no,original_receipt_no:dc.receipt_no,replacement_receipt_no:dc.replacement_receipt_no,old_amount:dc.old_amount,correct_amount:dc.correct_amount}});
}
module.exports={roles,apply,finish,pending,syncing,eligible};
