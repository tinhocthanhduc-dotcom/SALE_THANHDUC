'use strict';
// Server-only boundary. No token, signature or client configuration is projected to browsers.
const {stable}=require('../customer-directory/core.cjs');
function fail(code,details){throw Object.assign(new Error(code),{code,details});}
const manage=a=>a.roles.some(r=>['dispatcher','director'].includes(r));
function search(client,actor,p={}){if(!manage(actor))fail('FORBIDDEN');if(typeof p.q!=='string'||p.q.trim().length<2)return {customers:[]};return client.call(actor,'search',{q:p.q.trim().slice(0,200)});}
function createClient({config,send,hmac,now=()=>Date.now(),id}){
 return {call(actor,action,payload={},command={}){
  let c;try{c=config();}catch(e){fail('DIRECTORY_NOT_CONFIGURED');}if(!c||typeof c!=='object')fail('DIRECTORY_NOT_CONFIGURED');const mapping=c.actors?.[actor.id],role=actor.roles.includes('director')?'director':'dispatcher';
  if(!c.url||!c.secret)fail('DIRECTORY_NOT_CONFIGURED');
  if(!mapping||mapping.role!==role||!mapping.actor_id)fail('DIRECTORY_ACTOR_UNMAPPED');
  const envelope={client_id:'DIEUPHOI',actor_id:mapping.actor_id,timestamp:now(),nonce:id(),action,payload,...command};
  envelope.signature=hmac(stable(envelope),c.secret);
  let response;try{response=send(c.url,envelope);}catch(e){const code=e.code||e.message;if(/^(DIRECTORY_NOT_CONFIGURED|DIRECTORY_NETWORK_ERROR|DIRECTORY_HTTP_[0-9]{3}|DIRECTORY_GOOGLE_LOGIN|DIRECTORY_NON_JSON|DIRECTORY_RESPONSE_TOO_LARGE|DIRECTORY_REDIRECT_REJECTED)$/.test(code))fail(code);fail('DIRECTORY_UNAVAILABLE');}
  if(!response||typeof response.ok!=='boolean')fail('DIRECTORY_UNAVAILABLE');
  if(!response.ok)fail('DIRECTORY_'+(response.error||'UNAVAILABLE'),response.details);if(!response.data||typeof response.data!=='object')fail('DIRECTORY_UNAVAILABLE');
  return response.data;
 }};
}
function record(c,at){
 if(!c||!/^KTD-\d{6,}$/.test(c.MA_KHACH)||!Number.isSafeInteger(c.VERSION)||c.VERSION<1||c.TRANG_THAI!=='DANG_DUNG')fail('DIRECTORY_CUSTOMER_INACTIVE');
 return {ma_khach_chung:c.MA_KHACH,name:c.TEN,phone:(c.DIEN_THOAI||[]).join('; '),tax:c.MST||'',address:c.DIA_CHI||'',directory_type:c.LOAI,directory_version:c.VERSION,directory_fetched_at:at,directory_credit_limit:c.HAN_MUC_NO||0,directory_allow_credit:c.CHO_PHEP_NO===true,allow_credit:c.CHO_PHEP_NO===true};
}
function controller({client,auth,repository,now,id,catalogue}){
 const snapshot=()=>repository.snapshot().state;
 const cache=(actor,c,{customer_id,order_id,key,fingerprint,reason}={})=>repository.submit({type:'cache_directory_customer',idempotency_key:key||'directory:'+id(),payload:{customer_id,order_id,reason:reason||''}}, {actor,directory:auth.directory(),now,id,catalogue:catalogue.read(),directory_verified:record(c,now()),directory_source_fingerprint:fingerprint});
 function authorized(actor,p){const state=snapshot();if(p.order_id){const o=state.orders[p.order_id];if(!o||!require('./domain.cjs').canRead(actor,o))fail('FORBIDDEN');return {state,customer:state.customers[o.customer_id],order:o};}if(!manage(actor))fail('FORBIDDEN');return {state,customer:state.customers[p.customer_id]};}
 return {
  action(token,action,p={}){
   const actor=auth.actor(token);
   if(action==='directory_search')return search(client,actor,p);
   if(action==='directory_select'){
    if(!manage(actor))fail('FORBIDDEN');const state=snapshot();if(!/^KTD-\d{6,}$/.test(p.ma||''))fail('DIRECTORY_CODE_REQUIRED');if(p.customer_id){const existing=state.customers[p.customer_id];if(!existing)fail('UNKNOWN_CUSTOMER');if(existing.ma_khach_chung&&existing.ma_khach_chung!==p.ma)fail('DIRECTORY_ALREADY_LINKED');}
    if(typeof p.idempotency_key!=='string'||!p.idempotency_key.trim()||p.idempotency_key.length>180)fail('REQUIRED_FIELD');const fingerprint=stable({action,payload:{ma:p.ma,customer_id:p.customer_id}}),prior=state.commands[actor.id+':'+p.idempotency_key];if(prior){if(prior.fingerprint!==fingerprint)fail('IDEMPOTENCY_CONFLICT');return {...prior.result,replayed:true};}
    const remote=client.call(actor,'get',{ma:p.ma});return cache(actor,remote.customer,{customer_id:p.customer_id,key:p.idempotency_key,fingerprint,reason:'Liên kết mã khách chung'});
   }
   if(action==='directory_get'){
    const {customer,order}=authorized(actor,p);if(!customer)fail('UNKNOWN_CUSTOMER');
    if(!customer.ma_khach_chung)return {customer,unlinked:true};
    if(!p.force&&Date.parse(now())-Date.parse(customer.directory_fetched_at||'')<600000)return {customer,cached:true};
    const remote=client.call(actor,'get',{ma:customer.ma_khach_chung});const result=cache(actor,remote.customer,{customer_id:customer.id,order_id:order?.id,reason:'Làm mới từ Danh bạ'});return result;
   }
   fail('UNKNOWN_ACTION');
  },
  command(token,command){
   const actor=auth.actor(token);if(!manage(actor))fail('FORBIDDEN');const fingerprint=stable(command),key=actor.id+':'+command.idempotency_key,state=snapshot(),prior=state.commands[key];
   if(typeof command.idempotency_key!=='string'||!command.idempotency_key.trim()||('DIEUPHOI:'+actor.id+':'+command.idempotency_key).length>180)fail('REQUIRED_FIELD');if(prior){if(prior.fingerprint!==fingerprint)fail('IDEMPOTENCY_CONFLICT');return {...prior.result,replayed:true};}
   const p=command.payload||{},updating=command.type==='update_customer',existing=updating?state.customers[p.customer_id]:null;
   if(updating&&!existing?.ma_khach_chung)fail('DIRECTORY_CODE_REQUIRED');if(updating&&(!Number.isSafeInteger(command.expected_version)||command.expected_version<1))fail('DIRECTORY_VERSION_CONFLICT');
   if(p.machines?.length)fail('DIRECTORY_MACHINES_SEPARATE');
   // Debt approval remains per order; a directory credit limit is informational.
   if(p.allow_credit===true&&!actor.roles.includes('director'))fail('DIRECTORY_FIELD_FORBIDDEN');
   if(updating&&!actor.roles.includes('director')&&((p.name!==undefined&&p.name!==existing.name)||(p.tax!==undefined&&p.tax!==existing.tax)||(p.directory_type!==undefined&&p.directory_type!==existing.directory_type)))fail('DIRECTORY_FIELD_FORBIDDEN');
   const customer={...(p.name!==undefined?{TEN:p.name}:{}),...(p.phone!==undefined?{DIEN_THOAI:p.phone}:{}),...(p.address!==undefined?{DIA_CHI:p.address}:{}),...(p.tax!==undefined?{MST:p.tax}:{}),...(p.directory_type?{LOAI:p.directory_type}:{})};
   const remote=client.call(actor,updating?'update':'create',{customer,...(updating?{ma:existing.ma_khach_chung,reason:p.reason||'Sửa từ Điều phối'}:{})},{idempotency_key:'DIEUPHOI:'+actor.id+':'+command.idempotency_key,...(updating?{expected_version:command.expected_version}:{})});
   const result=cache(actor,remote.customer,{customer_id:existing?.id,key:command.idempotency_key,fingerprint,reason:updating?'Sửa trong Danh bạ':'Tạo trong Danh bạ'});return {...result,warnings:remote.warnings||[]};
  }
 };
}
module.exports={createClient,controller,record,search};
