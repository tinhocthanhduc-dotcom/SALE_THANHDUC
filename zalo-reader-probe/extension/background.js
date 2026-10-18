'use strict';
const ALARM='td-zalo-background',KEY='td-zalo-probe-v1';
async function install(){await chrome.alarms.create(ALARM,{periodInMinutes:1});}
chrome.runtime.onInstalled.addListener(()=>{void install();});
chrome.runtime.onStartup.addListener(()=>{void install();});
let running=false;
async function tick(){
 if(running)return;running=true;
 try{
  const s=(await chrome.storage.local.get(KEY))[KEY];if(!s?.autoScan)return;
  const tabs=await chrome.tabs.query({url:'https://chat.zalo.me/*'});
  if(tabs.length!==1){s.scanStatus='Quét nền tạm dừng: cần đúng một tab Zalo đang đăng nhập.';await chrome.storage.local.set({[KEY]:s});return;}
  try{await chrome.tabs.sendMessage(tabs[0].id,{app:'TD_ZALO_PROBE',action:'background-tick',group:'58'});}
  catch{const fresh=(await chrome.storage.local.get(KEY))[KEY];if(fresh){fresh.scanStatus='Chưa kết nối được tab Zalo. Mở Zalo và F5; sẽ thử lại.';await chrome.storage.local.set({[KEY]:fresh});}}
 }finally{running=false;}
}
chrome.alarms.onAlarm.addListener(a=>{if(a.name===ALARM)void tick();});
void install();
