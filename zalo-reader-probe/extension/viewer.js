'use strict';
const KEY='td-zalo-probe-v1',$=id=>document.getElementById(id);let records=[];
const requested=new URLSearchParams(location.search).get('group');$('group').value=requested==='145'?'145':'58';
function show(){const item=records[Number($('snapshot').value)],display=ZaloProbeCore.readable(item?.text||'');$('text').textContent=item?($('raw').checked?item.text:display.text):'';$('meta').textContent=item?(item.name||'Kho '+item.group)+' · '+($('raw').checked?item.text.length:display.text.length)+' ký tự'+(!$('raw').checked&&display.removed_lines?' · đã ẩn '+display.removed_lines+' dòng mã biểu tượng':'')+' · '+(item.captured_at?new Date(item.captured_at).toLocaleString('vi-VN'):'Không có thời điểm'):'Chưa có bản đọc thử cho kho này.';}

async function load(){try{const s=(await chrome.storage.local.get(KEY))[KEY];records=(s?.snapshots||[]).filter(x=>x.group===$('group').value).slice().reverse();$('snapshot').replaceChildren();records.forEach((item,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=(i===0?'Mới nhất · ':'')+(item.captured_at?new Date(item.captured_at).toLocaleString('vi-VN'):'Bản '+(records.length-i));$('snapshot').append(option);});show();}catch{$('meta').textContent='Không đọc được bộ nhớ tiện ích.';}}
$('raw').addEventListener('change',show);
$('group').addEventListener('change',load);$('snapshot').addEventListener('change',show);$('refresh').addEventListener('click',load);load();
