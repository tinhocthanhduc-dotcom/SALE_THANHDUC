'use strict';
const KEY='td-zalo-probe-v1',C=globalThis.ZaloProbeCore,$=id=>document.getElementById(id);
async function state(){return (await chrome.storage.local.get(KEY))[KEY]||C.initial();}
async function render(){const s=await state(),g=$('group').value,c=s.groups[g],items=s.snapshots.filter(x=>x.group===g);$('scan-state').textContent=(s.autoScan?'Tự quét hai nhóm · ':'')+(s.scanStatus||'');$('name').textContent=c?.name||'Chưa chọn tên nhóm';$('status').textContent=s.status[g]?.text||'Mở đúng nhóm trên Zalo Web, rồi chọn tên và khung tin.';$('count').textContent=items.length+' bản đọc thử · '+(c?.watch?'Đang theo dõi khi tab hiển thị':'Chưa theo dõi');$('preview').textContent=items.at(-1)?.text.slice(0,1400)||'';}
$('group').addEventListener('change',()=>render().catch(showError));
function showError(){ $('status').textContent='Không kết nối được. Mở chat.zalo.me, tải lại trang rồi thử lại.'; }
for(const button of document.querySelectorAll('[data-action]'))button.addEventListener('click',async()=>{
 if(button.dataset.action==='clear'&&!confirm('Xóa cấu hình và bản đọc thử của nhóm đang chọn?'))return;
 button.disabled=true;
 try{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});const r=await chrome.tabs.sendMessage(tab.id,{app:'TD_ZALO_PROBE',action:button.dataset.action,group:$('group').value});if(!r?.ok){$('status').textContent=r?.error||'Không thực hiện được.';return;}if(button.dataset.action.startsWith('pick-'))window.close();else await render();}catch{showError();}finally{button.disabled=false;}
});
$('export').addEventListener('click',async()=>{try{const s=await state();const report={tool:'TD_ZALO_PROBE',app_version:'0.2.0',version:1,exported_at:new Date().toISOString(),verified_on_live_zalo:false,notice:'Bản đọc DOM để chủ đối chiếu; chưa xác nhận đủ lịch sử, người gửi, ID tin hay chống trùng tin.',...s};const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='zalo-doc-thu-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}catch{showError();}});
chrome.storage.onChanged.addListener(()=>render().catch(showError));render().catch(showError);
