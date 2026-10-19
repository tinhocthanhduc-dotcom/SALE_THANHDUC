/* Loaded only by the extension service worker. Never expose config to content scripts. */
(() => {
 'use strict';
 const CONFIG='td-zalo-sync-config-v1',STATE='td-zalo-sync-state-v1',KEY='td-zalo-probe-v1',C=globalThis.ZaloSyncCore;let running=false;
 async function config(){return (await chrome.storage.local.get(CONFIG))[CONFIG]||{enabled:false};}
 async function state(){return (await chrome.storage.local.get(STATE))[STATE]||{receipts:{},failures:0};}
 async function request(c,payload){C.endpoint(c.endpoint);if(!await chrome.permissions.contains({origins:C.origins}))throw Error('Chưa cấp quyền Apps Script; mở màn Tự lưu Google Sheets để cài.');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{const response=await fetch(c.endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(await C.envelope(c,payload)),signal:controller.signal,credentials:'omit',redirect:'follow'});if(!response.ok)throw Error('Không kết nối được máy chủ (HTTP '+response.status+').');let result;try{result=await response.json();}catch{throw Error('Máy chủ chưa trả JSON. Kiểm tra URL /exec và quyền triển khai.');}if(!result.ok||result.service!=='TD_ZALO_ARCHIVE_V1')throw Error(result.error||'Không đúng máy chủ lưu Zalo.');if(payload.action==='ingest'&&result.digest!==payload.snapshot.digest)throw Error('Máy chủ xác nhận sai bản đọc; chưa đánh dấu đã gửi.');return result;}catch(e){if(e.name==='AbortError')throw Error('Máy chủ chưa trả lời sau 20 giây; sẽ gửi lại không trùng.');throw e;}finally{clearTimeout(timer);}}
 async function sync(force=false){if(running)return {sent:0};running=true;let sent=0;try{const c=await config();if(!c.enabled){if(force)throw Error('Chưa bật tự gửi Google Sheets.');return {sent};}const s=await state();if(!force&&s.nextAt>Date.now())return {sent};const snapshots=(await chrome.storage.local.get(KEY))[KEY]?.snapshots||[];
  try{for(const snapshot of C.pending(snapshots,s.receipts)){await request(c,{action:'ingest',snapshot});s.receipts[snapshot.digest]={at:new Date().toISOString()};sent++;s.lastAt=new Date().toISOString();s.error='';s.failures=0;s.nextAt=0;await chrome.storage.local.set({[STATE]:s});}}
  catch(e){s.lastAt=new Date().toISOString();s.error=e.message;s.failures=(s.failures||0)+1;s.nextAt=Date.now()+Math.min(900000,60000*2**Math.min(s.failures-1,4));await chrome.storage.local.set({[STATE]:s});if(force)throw e;}
  return {sent};
 }finally{running=false;}}
 chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
  if(msg?.app==='TD_ZALO_SYNC_REQUEST'&&sender.tab?.url?.startsWith('https://chat.zalo.me/')){void sync().then(v=>reply({ok:true,...v})).catch(()=>reply({ok:false}));return true;}
  if(msg?.app!=='TD_ZALO_SYNC'||!sender.url?.startsWith(chrome.runtime.getURL('')))return;
  (async()=>{if(msg.action==='configure'){const c=await config();C.endpoint(msg.endpoint);const secret=msg.secret||c.secret;if(!secret||secret.length<32)throw Error('Cần khóa kết nối ít nhất 32 ký tự từ Apps Script.');if(running)throw Error('Đang gửi; chờ xong rồi đổi cấu hình.');if(c.endpoint&&msg.endpoint!==c.endpoint){const s=await state();if(Object.keys(s.receipts).length)throw Error('Đã đồng bộ vào file cũ. Chưa hỗ trợ đổi đích để tránh ghi nhầm; cần cấu hình chuyển dữ liệu riêng.');}await chrome.storage.local.set({[CONFIG]:{endpoint:msg.endpoint,secret,enabled:msg.enabled===true}});return {};}
   if(msg.action==='status'){const c=await config(),s=await state(),snapshots=(await chrome.storage.local.get(KEY))[KEY]?.snapshots||[];return {endpoint:c.endpoint||'',enabled:c.enabled,synced:Object.keys(s.receipts).length,pending:snapshots.filter(x=>!s.receipts[x.digest]).length,lastAt:s.lastAt,error:s.error};}
   if(msg.action==='test'){const c=await config();if(!c.secret)throw Error('Chưa cài khóa kết nối.');return request(c,{action:'ping'});}
   if(msg.action==='send')return sync(true);throw Error('Lệnh không hợp lệ');})().then(v=>reply({ok:true,...v})).catch(e=>reply({ok:false,error:e.message}));return true;
 });
 globalThis.ZaloArchiveSync=sync;
})();
