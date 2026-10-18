'use strict';
importScripts('drafts-core.js');
const ALARM='td-zalo-background',KEY='td-zalo-probe-v1',SCHEDULE='td-zalo-schedule-v1',DRAFTS='td-zalo-drafts-v1',D=globalThis.ZaloDraftCore;
async function install(){if(!await chrome.alarms.get(ALARM))await chrome.alarms.create(ALARM,{periodInMinutes:1});}
chrome.runtime.onInstalled.addListener(()=>{void install();});
chrome.runtime.onStartup.addListener(()=>{void install();void tick();});
let running=false,chain=Promise.resolve();
const serial=fn=>{const p=chain.then(fn);chain=p.catch(()=>{});return p;};
async function setting(){return (await chrome.storage.local.get(SCHEDULE))[SCHEDULE]||{enabled:false,done:{}};}
async function setSchedule(enabled){const s=await setting();if(enabled&&(!s.enabled||s.policy!=='hourly-foreground'))s.enabledAt=new Date().toISOString();s.policy='hourly-foreground';s.enabled=enabled;await chrome.storage.local.set({[SCHEDULE]:s});return s;}
async function extract(){
 const all=await chrome.storage.local.get([KEY,DRAFTS]),data=all[DRAFTS]||{drafts:[]},seen=new Set(data.drafts.map(x=>x.key));let added=0;
 for(const snapshot of all[KEY]?.snapshots||[])for(const c of D.candidates(snapshot))if(!seen.has(c.key)){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(c.key));data.drafts.push({...c,id:[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join(''),status:'PENDING',version:1,to:'',checked:false,note:'',createdAt:new Date().toISOString()});seen.add(c.key);added++;}
 if(JSON.stringify(data).length>2000000)throw Error('Bộ nhớ nháp đầy. Xuất dữ liệu để lưu dự phòng; chưa thêm nháp mới.');
 await chrome.storage.local.set({[DRAFTS]:data});return {added};
}
async function updateDraft(msg){const data=(await chrome.storage.local.get(DRAFTS))[DRAFTS]||{drafts:[]},index=data.drafts.findIndex(x=>x.id===msg.id);if(index<0)throw Error('Không tìm thấy nháp');const old=data.drafts[index];if(old.version!==msg.version)throw Error('Nháp đã thay đổi ở cửa sổ khác. Tải lại trang trước khi sửa.');const p=msg.patch||{};if(!['PENDING','REVIEWED','IGNORED'].includes(p.status)||!Array.isArray(p.items)||p.items.length>100)throw Error('Dữ liệu nháp không hợp lệ');const next={...old,date:String(p.date||''),type:String(p.type||''),group:String(p.group||''),to:String(p.to||''),items:p.items.map(x=>({name:String(x.name||'').slice(0,500),td:String(x.td||'').slice(0,100),quantity:String(x.quantity||'').slice(0,30)})),checked:p.checked===true,note:String(p.note||'').slice(0,2000),status:p.status,version:old.version+1,updatedAt:new Date().toISOString()};
 if(next.status==='REVIEWED'){const errors=D.validate(next);if(errors.length)throw Error(errors.join(' · '));}data.drafts[index]=next;if(JSON.stringify(data).length>2000000)throw Error('Bộ nhớ nháp đầy');await chrome.storage.local.set({[DRAFTS]:data});return {};
}
async function foregroundScan(tab){
 const ready=await chrome.tabs.sendMessage(tab.id,{app:'TD_ZALO_PROBE',action:'prepare-window-scan',group:'58'});
 if(!ready?.ok)return ready||{ok:false,error:'Không chuẩn bị được tab Zalo.'};
 let original,previous,active,focusChanged=false,tabChanged=false,restorable=false;
 const onFocus=id=>{if(restorable&&id!==tab.windowId)focusChanged=true;};
 const onTab=info=>{if(restorable&&info.windowId===tab.windowId&&info.tabId!==tab.id)tabChanged=true;};
 try{
  original=await chrome.windows.get(tab.windowId);previous=await chrome.windows.getLastFocused();
  [active]=await chrome.tabs.query({windowId:tab.windowId,active:true});
  if(original.state==='minimized')await chrome.windows.update(tab.windowId,{state:'normal'});
  await chrome.tabs.update(tab.id,{active:true});await chrome.windows.update(tab.windowId,{focused:true});
  chrome.windows.onFocusChanged.addListener(onFocus);chrome.tabs.onActivated.addListener(onTab);restorable=true;
  await new Promise(r=>setTimeout(r,3000));
  if(focusChanged||tabChanged)return {ok:false,error:'Anh đang thao tác cửa sổ khác; lượt quét tạm dừng.'};
  return await chrome.tabs.sendMessage(tab.id,{app:'TD_ZALO_PROBE',action:'background-tick',group:'58',scheduled:true,foreground:true});
 }finally{
  let interacted=true;try{const finish=await chrome.tabs.sendMessage(tab.id,{app:'TD_ZALO_PROBE',action:'finish-window-scan',group:'58'});interacted=!finish?.ok||finish.interacted;}catch{/* Leave window alone when interaction state is unknown. */}
  chrome.windows.onFocusChanged.removeListener(onFocus);chrome.tabs.onActivated.removeListener(onTab);
  if(original&&!interacted&&!focusChanged&&!tabChanged){
   try{if(active&&active.id!==tab.id)await chrome.tabs.update(active.id,{active:true});
    if(original.state==='minimized')await chrome.windows.update(tab.windowId,{state:'minimized'});
    if(previous&&previous.id!==tab.windowId)await chrome.windows.update(previous.id,{focused:true});
   }catch{/* User may close the window while scanning; never recreate it. */}
  }
 }
}
async function tick(){
 if(running)return;running=true;
 try{
  const settings=await setting();if(settings.policy!=='hourly-foreground')return;const due=D.due(settings,Date.now());if(!due.length)return;
  await serial(async()=>{const fresh=await setting();if(!fresh.enabled)return;fresh.attempted=fresh.attempted||{};for(const slot of due)fresh.attempted[slot]=new Date().toISOString();const today=D.clock(Date.now()).day;fresh.attempted=Object.fromEntries(Object.entries(fresh.attempted).filter(([k])=>k.startsWith(today)));await chrome.storage.local.set({[SCHEDULE]:fresh});});
  if(!(await setting()).enabled)return;
  const tabs=await chrome.tabs.query({url:'https://chat.zalo.me/*'});let result;
  if(tabs.length!==1)result={ok:false,error:'Cần đúng một tab Zalo đang đăng nhập.'};
  else try{result=await foregroundScan(tabs[0]);}catch{result={ok:false,error:'Chưa kết nối cửa sổ Zalo; mở Zalo và F5.'};}
  await serial(async()=>{const fresh=await setting();fresh.lastAttemptAt=new Date().toISOString();fresh.lastStatus=result?.ok&&!result.skipped?'Đã mở cửa sổ và đọc DOM; đối chiếu tin mới trên Zalo.':(result?.error?result.error+' Chờ giờ kế tiếp hoặc quét thủ công.':null)||'Đang có thao tác khác; chờ giờ kế tiếp hoặc quét thủ công.';
   if(result?.ok&&!result.skipped&&fresh.enabled){const completed=due;fresh.done=fresh.done||{};for(const slot of due)if(completed.includes(slot))fresh.done[slot]=fresh.lastAttemptAt;const today=D.clock(Date.now()).day;fresh.done=Object.fromEntries(Object.entries(fresh.done).filter(([k])=>k.startsWith(today)));}
   await chrome.storage.local.set({[SCHEDULE]:fresh});if(result?.ok&&!result.skipped)await extract();});
 }finally{running=false;}
}
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
 if(msg?.app==='TD_ZALO_STOP_SCHEDULE'&&sender.tab?.url?.startsWith('https://chat.zalo.me/')){serial(()=>setSchedule(false)).then(()=>reply({ok:true}));return true;}
 if(msg?.app!=='TD_ZALO_DRAFTS'||!sender.url?.startsWith(chrome.runtime.getURL('')))return;
 serial(async()=>{if(msg.action==='schedule')return setSchedule(msg.enabled===true);if(msg.action==='extract')return extract();if(msg.action==='update')return updateDraft(msg);throw Error('Lệnh không hợp lệ');}).then(value=>reply({ok:true,...value})).catch(e=>reply({ok:false,error:e.message}));return true;
});
chrome.alarms.onAlarm.addListener(a=>{if(a.name===ALARM)void tick().catch(()=>{});});
void install();
