'use strict';
const $=id=>document.getElementById(id);let busy=false;
function message(s){$('status').textContent=s;}
async function call(action,extra={}){const r=await chrome.runtime.sendMessage({app:'TD_ZALO_SYNC',action,...extra});if(!r?.ok)throw Error(r?.error||'Không nhận được kết quả');return r;}
async function summary(){const r=await call('status');$('summary').textContent='Đã lưu lên Sheets: '+r.synced+' · Chờ gửi: '+r.pending+(r.lastAt?' · Lần gần nhất: '+new Date(r.lastAt).toLocaleString('vi-VN'):'')+(r.error?' · '+r.error:'');return r;}
async function save(){const endpoint=ZaloSyncCore.endpoint($('endpoint').value.trim());if(!await chrome.permissions.request({origins:ZaloSyncCore.origins}))throw Error('Chưa được cấp quyền kết nối Apps Script.');await call('configure',{endpoint,secret:$('secret').value.trim(),enabled:$('enabled').checked});$('secret').value='';}
async function perform(fn){if(busy)return;busy=true;for(const b of document.querySelectorAll('button'))b.disabled=true;try{await fn();await summary();}catch(e){message(e.message);}finally{busy=false;for(const b of document.querySelectorAll('button'))b.disabled=false;}}
$('config').onsubmit=e=>{e.preventDefault();void perform(async()=>{await save();message('Đã lưu cấu hình.');});};
$('test').onclick=()=>perform(async()=>{await save();const r=await call('test');message('Kết nối OK · file: '+r.workbook_id);});
$('send').onclick=()=>perform(async()=>{const r=await call('send');message('Lượt này đã gửi '+r.sent+' bản; các bản còn lại sẽ gửi ở lượt sau.');});
summary().then(r=>{$('endpoint').value=r.endpoint||'';$('enabled').checked=r.enabled;}).catch(e=>message(e.message));
