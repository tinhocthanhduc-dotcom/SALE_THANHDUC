(() => {
 'use strict';
 const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
 const slots=Array.from({length:11},(_,i)=>String(i+9).padStart(2,'0')+':00');
 function clock(now){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now));const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return {day:p.year+'-'+p.month+'-'+p.day,time:p.hour+':'+p.minute};}
 function due(settings,now){if(!settings?.enabled)return [];const c=clock(now);if(c.time<'09:00'||c.time>'19:00')return [];return slots.filter(t=>{const key=c.day+'T'+t;return t===c.time&&new Date(key+':00+07:00').getTime()>=Date.parse(settings.enabledAt)&&!settings.done?.[key]&&!settings.attempted?.[key];}).map(t=>c.day+'T'+t);}
 function validDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;}
 function sourceDate(text){const m=text.match(/(?:ngày\s*)?(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);if(!m)return '';const s=(m[3].length===2?'20'+m[3]:m[3])+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');return validDate(s)?s:'';}
 function candidates(snapshot){
  const lines=String(snapshot.text||'').split(/\r?\n/),out=[];let date='',block=null;
  function flush(){if(!block)return;const raw=block.lines.join('\n').trim(),f=fold(raw);let type=f.includes('dieu chuyen')?'TRANSFER':f.includes('nhap kho')?'IN':f.includes('xuat kho')?'OUT':'';
   if(type){const numbered=raw.replace(/^\s*\d+\s*[\/.)-]\s*/,''),body=numbered.replace(/^(?:nhập kho|xuất kho|điều chuyển)\s*:?\s*/i,'');
    const items=body.split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean).map(s=>{let m=s.match(/^(.+?)\s+(?:sl|số lượng)\s*:?\s*(\d+(?:[.,]\d+)?)\s*$/i);if(m)return {name:m[1],quantity:m[2].replace(',','.'),td:''};m=s.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);if(m)return {name:m[2],quantity:m[1].replace(',','.'),td:''};return {name:s,quantity:'',td:''};});
    out.push({group:snapshot.group,raw,date:block.date,type,items,sourceDigest:snapshot.digest,capturedAt:snapshot.captured_at,key:JSON.stringify([snapshot.group,block.date,fold(raw).replace(/\s+/g,' ').trim()])});}
   block=null;
  }
  for(const line of lines){const t=line.trim(),d=sourceDate(t);if(d&&!/^\d+\s*\//.test(t)){flush();date=d;continue;}if(/^(?:hôm nay|hôm qua|t\d\b)/i.test(t)){flush();date=d;continue;}
   if(/^\d+\s*[\/.)-]\s*(?:nhập kho|xuất kho|điều chuyển)/i.test(t)||/^(?:nhập kho|xuất kho|điều chuyển)\s*:/i.test(t)){flush();block={date,lines:[t]};}
   else if(block&&t){if(/^\d{1,2}:\d{2}(?:\s|$)/.test(t)){flush();}else block.lines.push(t);}
  }flush();return out;
 }
 function validate(d){const errors=[];if(!validDate(d.date))errors.push('Chọn ngày nghiệp vụ');if(!['IN','OUT','TRANSFER'].includes(d.type))errors.push('Chọn loại phiếu');if(!['58','145'].includes(d.group))errors.push('Chọn kho');if(d.type==='TRANSFER'&&(!['58','145'].includes(d.to)||d.to===d.group))errors.push('Chọn kho đến khác kho đi');if(!d.items?.length)errors.push('Thêm hàng');for(const [i,x]of(d.items||[]).entries()){if(!x.name.trim()||!x.td.trim()||!Number.isFinite(Number(x.quantity))||Number(x.quantity)<=0)errors.push('Dòng '+(i+1)+': cần tên, mã TD và số lượng > 0');}if(!d.checked)errors.push('Xác nhận đã đối chiếu bản gốc và mã hàng');return errors;}
 globalThis.ZaloDraftCore={fold,clock,due,candidates,validate};
})();
