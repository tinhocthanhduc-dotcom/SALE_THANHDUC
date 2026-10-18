'use strict';
importScripts('drafts-core.js');
const ALARM='td-zalo-background',KEY='td-zalo-probe-v1',SCHEDULE='td-zalo-schedule-v1',DRAFTS='td-zalo-drafts-v1',D=globalThis.ZaloDraftCore;
async function install(){if(!await chrome.alarms.get(ALARM))await chrome.alarms.create(ALARM,{periodInMinutes:1});}
chrome.runtime.onInstalled.addListener(()=>{void install();});
chrome.runtime.onStartup.addListener(()=>{void install();void tick();});
let running=false,chain=Promise.resolve();
const serial=fn=>{const p=chain.then(fn);chain=p.catch(()=>{});return p;};
async function setting(){return (await chrome.storage.local.get(SCHEDULE))[SCHEDULE]||{enabled:false,done:{}};}
async function setSchedule(enabled){const s=await setting();if(enabled&&!s.enabled)s.enabledAt=new Date().toISOString();s.enabled=enabled;await chrome.storage.local.set({[SCHEDULE]:s});return s;}
async function extract(){
 const all=await chrome.storage.local.get([KEY,DRAFTS]),data=all[DRAFTS]||{drafts:[]},seen=new Set(data.drafts.map(x=>x.key));let added=0;
 for(const snapshot of all[KEY]?.snapshots||[])for(const c of D.candidates(snapshot))if(!seen.has(c.key)){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(c.key));data.drafts.push({...c,id:[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join(''),status:'PENDING',version:1,to:'',checked:false,note:'',createdAt:new Date().toISOString()});seen.add(c.key);added++;}
 if(JSON.stringify(data).length>2000000)throw Error('Bộ nhớ nháp đầy. Xuất dữ liệu để lưu dự phòng; chưa thêm nháp mới.');
 await chrome.storage.local.set({[DRAFTS]:data});return {added};
}
async function updateDraft(msg){const data=(await chrome.storage.local.get(DRAFTS))[DRAFTS]||{drafts:[]},index=data.drafts.findIndex(x=>x.id===msg.id);if(index<0)throw Error('Không tìm thấy nháp');const old=data.drafts[index];if(old.version!==msg.version)throw Error('Nháp đã thay đổi ở cửa sổ khác. Tải lại trang trước khi sửa.');const p=msg.patch||{};if(!['PENDING','REVIEWED','IGNORED'].includes(p.status)||!Array.isArray(p.items)||p.items.length>100)throw Error('Dữ liệu nháp không hợp lệ');const next={...old,date:String(p.date||''),type:String(p.type||''),group:String(p.group||''),to:String(p.to||''),items:p.items.map(x=>({name:String(x.name||'').slice(0,500),td:String(x.td||'').slice(0,100),quantity:String(x.quantity||'').slice(0,30)})),checked:p.checked===true,note:String(p.note||'').slice(0,2000),status:p.status,version:old.version+1,updatedAt:new Date().toISOString()};
 if(next.status==='REVIEWED'){const errors=D.validate(next);if(errors.length)throw Error(errors.join(' · '));}data.drafts[index]=next;if(JSON.stringify(data).length>2000000)throw Error('Bộ nhớ nháp đầy');await chrome.storage.local.set({[DRAFTS]:data});return {};
}
async function tick(){
 if(running)return;running=true;
 try{
  const s=(await chrome.storage.local.get(KEY))[KEY],settings=await setting(),due=D.due(settings,Date.now());if(!s?.autoScan&&!due.length)return;
  const tabs=await chrome.tabs.query({url:'https://chat.zalo.me/*'});let result;
  if(tabs.length!==1){result={ok:false,error:'Cần đúng một tab Zalo đang đăng nhập.'};}
  else try{result=await chrome.tabs.sendMessage(tabs[0].id,{app:'TD_ZALO_PROBE',action:'background-tick',group:'58',scheduled:due.length>0});}catch{result={ok:false,error:'Chưa kết nối tab Zalo; mở Zalo và F5.'};}
  await serial(async()=>{const fresh=await setting();fresh.lastAttemptAt=new Date().toISOString();fresh.lastStatus=result?.ok&&!result.skipped?'Đã đọc DOM; cần đối chiếu tin mới trên Zalo.':result?.error||'Đang có thao tác khác; sẽ thử lại.';
   if(result?.ok&&!result.skipped&&fresh.enabled){const completed=D.due(fresh,Date.now());fresh.done=fresh.done||{};for(const slot of due)if(completed.includes(slot))fresh.done[slot]=fresh.lastAttemptAt;const today=D.clock(Date.now()).day;fresh.done=Object.fromEntries(Object.entries(fresh.done).filter(([k])=>k.startsWith(today)));}
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
