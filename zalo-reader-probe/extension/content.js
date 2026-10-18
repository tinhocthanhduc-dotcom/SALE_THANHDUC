(() => {
  'use strict';
  if (location.origin !== 'https://chat.zalo.me' || window !== window.top || globalThis.__tdZaloProbe) return;
  globalThis.__tdZaloProbe = true;
  const C = globalThis.ZaloProbeCore, KEY = 'td-zalo-probe-v1';
  let chain = Promise.resolve(), selecting = false, interactionEpoch = 0, lastScan = 0;
  for (const event of ['pointerdown','keydown']) window.addEventListener(event,e=>{if(e.isTrusted)interactionEpoch++;},true);
  const errors = {
    NAV_UNSAFE: 'Vùng chọn không phải dòng mở nhóm an toàn. Chọn dòng nhóm trong danh sách chat bên trái.',
    ENTRY_NOT_FOUND: 'Không tìm thấy dòng nhóm đã gán. Ghim/đưa cả hai nhóm vào danh sách bên trái rồi chọn lại bước 4.',
    ENTRY_AMBIGUOUS: 'Có nhiều dòng cùng tên nhóm trong vùng đã chọn. Không tự đoán; cần phân biệt tên nhóm.',
    USER_BUSY: 'Đã dừng chuyển nhóm vì anh đang thao tác hoặc có nội dung đang soạn.',
    SWITCH_TIMEOUT: 'Tên nhóm đã đúng nhưng chưa xác minh được khung tin đổi xong. Không lưu nội dung.',
    SWITCH_HEADER: 'Đã nhấn mở nhưng chưa nhận diện đúng khung tên nhóm. Mở nhóm đó, chọn lại bước 1 và đọc thử.',
    SWITCH_PANE: 'Tên nhóm đã đúng nhưng khung tin đã đổi đường dẫn. Mở nhóm đó, chọn lại bước 2 và đọc thử.',
    GROUP_CHANGED: 'Nhóm đang mở khác nhóm đã chọn. Dừng đọc nhóm này; mở đúng nhóm hoặc chọn lại.',
    SELECTOR_CHANGED: 'Không tìm thấy đúng vùng đã chọn. Hãy chọn lại tên nhóm và khung tin.',
    COMPOSER_SELECTED: 'Vùng chọn có ô soạn tin. Hãy chọn khung chứa tin nhắn, không chọn cả trang.',
    EMPTY_PANE: 'Khung tin chưa có chữ để đọc. Chờ tải tin hoặc chọn lại khung.',
    LOCAL_LIMIT: 'Bộ nhớ thử đã đầy. Xuất kết quả rồi xóa dữ liệu để thử tiếp.',
    TOO_LARGE: 'Khung chọn quá lớn. Chọn khung tin nhỏ hơn.',
    PAGE_HIDDEN: 'Tab Zalo đang ẩn. Bản thử chỉ đọc tab đang hiển thị.',
    PICK_CANCELLED: 'Đã hủy chọn vùng.',
    STORAGE_ERROR: 'Không lưu được trên máy. Kiểm tra dung lượng/quyền tiện ích.'
  };
  const serial = fn => {const task = chain.then(fn); chain = task.catch(() => {}); return task;};
  async function load() {const value = (await chrome.storage.local.get(KEY))[KEY]; return value?.version === 1 ? value : C.initial();}
  async function save(state) {try {await chrome.storage.local.set({[KEY]: state});} catch {throw Error('STORAGE_ERROR');}}
  async function status(group, text) {const s = await load(); s.status[group] = {at: new Date().toISOString(), text}; await save(s);}
  function unique(selector) {let els; try {els = document.querySelectorAll(selector);} catch {throw Error('SELECTOR_CHANGED');} if (els.length !== 1) throw Error('SELECTOR_CHANGED'); return els[0];}
  function path(el, structural=false) {
    const parts = [];
    for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
      if (!structural && node.id && document.querySelectorAll('#' + CSS.escape(node.id)).length === 1) {parts.unshift('#' + CSS.escape(node.id)); break;}
      const tag = node.tagName.toLowerCase(), peers = [...node.parentElement.children].filter(x => x.tagName === node.tagName);
      parts.unshift(tag + ':nth-of-type(' + (peers.indexOf(node) + 1) + ')');
    }
    return parts.join(' > ');
  }
  function safePane(el) {
    if (!el || [document.body, document.documentElement].includes(el) || el.matches('input,textarea,[contenteditable="true"]') || el.querySelector('input,textarea,[contenteditable="true"]')) throw Error('COMPOSER_SELECTED');
    if (el.getBoundingClientRect().width < 40 || el.getBoundingClientRect().height < 20) throw Error('SELECTOR_CHANGED');
    return el;
  }
  function pick(group, kind) {
    if (selecting) throw Error('Đang chọn vùng. Bấm Esc để hủy trước.');
    selecting = true;
    const banner = document.createElement('div'), outline = document.createElement('div');
    banner.textContent = (kind === 'header' ? 'Chọn đúng tên nhóm ở đầu cuộc trò chuyện.' : kind === 'entry' ? 'Chọn dòng nhóm ở danh sách chat bên trái; có thể chọn tên hoặc cả dòng có tin xem trước.' : 'Chọn khung tin nhắn. ↑ mở rộng vùng, ↓ thu nhỏ.') + ' Bấm chuột để chốt · Esc hủy.';
    banner.style.cssText = 'position:fixed;bottom:12px;right:12px;max-width:360px;padding:16px;background:#15374b;color:white;font:16px sans-serif;z-index:2147483647;pointer-events:none;';
    outline.style.cssText = 'position:fixed;border:3px solid #e36a16;background:#ff990018;pointer-events:none;z-index:2147483646;box-sizing:border-box;';
    document.body.append(banner, outline);
    let base = null, candidate = null, depth = 0;
    function draw() {candidate = base; for (let i=0; i<depth && candidate?.parentElement; i++) candidate=candidate.parentElement; if (!candidate) return; const r=candidate.getBoundingClientRect();Object.assign(outline.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});}
    function move(e) {if (e.target === banner || e.target === outline) return; base=e.target;draw();}
    function close() {selecting=false;banner.remove();outline.remove();window.removeEventListener('mousemove',move,true);window.removeEventListener('click',click,true);window.removeEventListener('keydown',key,true);}
    function key(e) {if (!['Escape','ArrowUp','ArrowDown'].includes(e.key)) return; e.preventDefault();e.stopImmediatePropagation();if(e.key==='Escape'){close();void serial(()=>status(group,errors.PICK_CANCELLED)).catch(()=>{});}else{depth=Math.max(0,depth+(e.key==='ArrowUp'?1:-1));draw();}}
    function click(e) {
      e.preventDefault();e.stopImmediatePropagation();const el=candidate||e.target;close();
      void serial(async()=>{
        try {
          if (!el || [document.body,document.documentElement].includes(el)) throw Error('SELECTOR_CHANGED');
          const s=await load(),config=s.groups[group]||{};
          if(kind==='header') {const name=C.title(el.innerText);if(!name||name.length>160)throw Error('Hãy chọn riêng dòng tên nhóm.');config.header=path(el);config.headerFallback=path(el,true);config.headerTag=el.tagName;config.name=name;}
          else if(kind==='entry'){const label=bindEntry(el,config);config.entry=path(label);config.entryScope=path(entryRegion(label,config));}
          else {safePane(el);config.pane=path(el);config.paneFallback=path(el,true);config.paneTag=el.tagName;}
          config.watch=false;s.autoScan=false;if(kind==='entry')s.scanStatus='Đã chọn nút mở nhóm. Có thể quét thử hai nhóm khi đã chọn đủ hai kho.';s.groups[group]=config;s.status[group]={at:new Date().toISOString(),text:kind==='header'?'Đã chọn tên nhóm.':kind==='entry'?'Đã chọn nút mở nhóm.':'Đã chọn khung tin.'};await save(s);
        } catch(err) {await status(group,errors[err.message]||err.message);}
      }).catch(()=>{});
    }
    window.addEventListener('mousemove',move,true);window.addEventListener('click',click,true);window.addEventListener('keydown',key,true);
  }
  function excludedEntry(el,config) {
    if(!el||[document.body,document.documentElement].includes(el)||el.closest('button,a,input,textarea,form,[contenteditable="true"]')||el.querySelector('input,textarea,[contenteditable="true"]')||!el.getClientRects().length)return true;
    const header=config.header?document.querySelector(config.header):null,pane=config.pane?document.querySelector(config.pane):null;
    return !!(header&&(header.contains(el)||el.contains(header))||pane&&(pane.contains(el)||el.contains(pane)));
  }
  function entryLabels(root,name){
    return [root,...root.querySelectorAll('*')].filter(el=>el.getClientRects().length&&C.title(el.innerText)===name&&![...el.children].some(child=>C.title(child.innerText)===name));
  }
  function safeEntry(el,config) {
    if(!config?.name||excludedEntry(el,config))throw Error('NAV_UNSAFE');
    const labels=entryLabels(el,config.name).filter(label=>!excludedEntry(label,config));
    if(labels.length!==1)throw Error(labels.length?'ENTRY_AMBIGUOUS':'ENTRY_NOT_FOUND');
    return labels[0];
  }
  function bindEntry(el,config){
    for(let node=el;node&&!excludedEntry(node,config);node=node.parentElement){
      const labels=entryLabels(node,config.name).filter(label=>!excludedEntry(label,config));
      if(labels.length>1)throw Error('ENTRY_AMBIGUOUS');
      if(labels.length===1)return labels[0];
    }
    throw Error('NAV_UNSAFE');
  }
  function entryRegion(label,config){
    let region=label;
    for(let parent=label.parentElement;parent&&!excludedEntry(parent,config);parent=parent.parentElement)region=parent;
    return region;
  }
  function resolveEntry(config){
    if(config.entryScope){
      let scope;try{scope=unique(config.entryScope);}catch{throw Error('ENTRY_NOT_FOUND');}
      return safeEntry(scope,config); // Exact title within the user-bound sidebar only; no page-wide/fuzzy search.
    }
    return safeEntry(unique(config.entry),config);
  }
  function activateEntry(label){
    const r=label.getBoundingClientRect(),common={bubbles:true,cancelable:true,view:window,clientX:r.left+r.width/2,clientY:r.top+r.height/2,button:0};
    // Some Zalo layouts open rows on mousedown rather than click. Do not elevate
    // privileges or fake trusted input; only dispatch to the explicitly bound label.
    for(const [type,pointer] of [['pointerdown',true],['mousedown',false],['pointerup',true],['mouseup',false],['click',false]]){
      if(!label.isConnected)break;
      label.dispatchEvent(pointer?new PointerEvent(type,{...common,pointerType:'mouse',isPrimary:true,buttons:type==='pointerdown'?1:0}):new MouseEvent(type,{...common,buttons:type==='mousedown'?1:0}));
    }
  }
  function visibleFrame(el){
    if(!el||!el.getClientRects().length||el.closest('[aria-hidden="true"]'))return false;
    const r=el.getBoundingClientRect();
    return r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth&&(!el.checkVisibility||el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}));
  }
  function boundCandidate(config,part,el){
    if(!visibleFrame(el))return false;
    if(config[part+'Tag']&&el.tagName!==config[part+'Tag'])return false;
    let sidebar;try{sidebar=config.entryScope?document.querySelector(config.entryScope):null;}catch{return false;}
    return !sidebar?.contains(el);
  }
  function selectedElement(config,part,accept){
    for(const selector of [...new Set([config[part],config[part+'Fallback']].filter(Boolean))]){
      try{const el=unique(selector);if(boundCandidate(config,part,el)&&accept(el))return el;}catch{/* Try only the other path explicitly learned from a selected frame. */}
    }
    return null;
  }
  function frame(config) {
    if(document.hidden)throw Error('PAGE_HIDDEN');
    if(!config?.header||!config?.pane)throw Error('SELECTOR_CHANGED');
    const header=selectedElement(config,'header',el=>C.title(el.innerText)===config.name);
    if(!header)throw Error('GROUP_CHANGED');
    const pane=selectedElement(config,'pane',el=>{safePane(el);return !el.contains(header)&&!header.contains(el);});
    if(!pane)throw Error('SELECTOR_CHANGED');
    if(pane.matches('[aria-busy="true"]')||[...pane.querySelectorAll('[aria-busy="true"],[role="progressbar"]')].some(el=>el.getClientRects().length))throw Error('EMPTY_PANE');
    const text=C.clean(pane.innerText);if(!text)throw Error('EMPTY_PANE');if(text.length>50000)throw Error('TOO_LARGE');
    return {header,pane,text};
  }
  function idle(epoch) {
    if(epoch!==interactionEpoch||document.activeElement?.matches('input')&&C.clean(document.activeElement.value))throw Error('USER_BUSY');
    for(const el of document.querySelectorAll('textarea,[contenteditable="true"]'))if(el.getClientRects().length&&C.clean(el.value||el.innerText))throw Error('USER_BUSY');
    if(document.hidden)throw Error('PAGE_HIDDEN');
  }
  async function openGroup(config,epoch) {
    idle(epoch);
    try{frame(config);return;}catch(e){if(!['GROUP_CHANGED','EMPTY_PANE','SELECTOR_CHANGED'].includes(e.message))throw e;}
    let oldText,oldPane;try{oldPane=unique(config.pane);const rect=oldPane.getBoundingClientRect();if(visibleFrame(oldPane)&&rect.width>=40&&rect.height>=20)oldText=C.clean(oldPane.innerText);else oldPane=null;}catch{/* Target pane may only mount after opening its group. */}
    activateEntry(resolveEntry(config)); // Only user-bound sidebar navigation, never message/send controls.
    const end=Date.now()+8000;let stable='',since=0,lastError='GROUP_CHANGED',previousPane=null;
    while(Date.now()<end){
      idle(epoch);
      try{const next=frame(config);lastError='SWITCH_TIMEOUT';if(next.text!==oldText||oldPane&&next.pane!==oldPane){if(next.text!==stable||next.pane!==previousPane){stable=next.text;previousPane=next.pane;since=Date.now();}else if(Date.now()-since>=700)return;}else{stable='';since=0;}}
      catch(e){if(!['GROUP_CHANGED','EMPTY_PANE','SELECTOR_CHANGED'].includes(e.message))throw e;lastError=e.message;stable='';since=0;}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw Error(lastError==='GROUP_CHANGED'?'SWITCH_HEADER':lastError==='SELECTOR_CHANGED'?'SWITCH_PANE':'SWITCH_TIMEOUT');
  }
  async function scanBoth(){
    const epoch=interactionEpoch,s=await load();
    for(const group of ['58','145']){const c=s.groups[group];if(!c?.name||!c.header)throw Error('Kho '+group+': chưa chọn tên nhóm ở bước 1.');if(!c.pane)throw Error('Kho '+group+': chưa chọn khung tin ở bước 2.');if(!c.entry)throw Error('Kho '+group+': chưa chọn dòng mở nhóm ở bước 4.');}
    if(s.groups['58'].name===s.groups['145'].name)throw Error('NAV_UNSAFE');
    for(const group of ['58','145']){
      try{await openGroup(s.groups[group],epoch);idle(epoch);await safelyCapture(group);}
      catch(e){const message='Kho '+group+': '+(errors[e.message]||e.message);await status(group,message);throw Error(message);}
    }
    const fresh=await load();fresh.scanStatus='Đã quét hai nhóm lúc '+new Date().toLocaleTimeString('vi-VN');await save(fresh);lastScan=Date.now();
  }
  async function capture(group) {
    const s=await load(),config=s.groups[group];
    const before=frame(config),text=before.text;
    // Only the selected, loaded DOM text; no cookies, private API or input values.
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(group+'\n'+config.name+'\n'+text));
    const digest=[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
    const after=frame(config);if(after.pane!==before.pane||after.text!==text)throw Error('GROUP_CHANGED');
    const item={kind:'loaded_dom_snapshot',group,name:config.name,captured_at:new Date().toISOString(),digest,text};
    const out=C.append(s,item);out.state.groups[group]={...config,header:path(before.header),headerFallback:path(before.header,true),headerTag:before.header.tagName,pane:path(before.pane),paneFallback:path(before.pane,true),paneTag:before.pane.tagName};out.state.status[group]={at:item.captured_at,text:out.added?'Đã lưu bản đọc thử.':'Nội dung giống bản đã lưu; không lưu trùng.'};await save(out.state);
    return {added:out.added,characters:text.length};
  }
  async function safelyCapture(group) {try{return await capture(group);}catch(err){await status(group,errors[err.message]||'Không đọc được vùng đã chọn. Chọn lại vùng và thử lại.');throw err;}}
  chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
    if(!msg||msg.app!=='TD_ZALO_PROBE')return;
    if(!['58','145'].includes(msg.group)){reply({ok:false,error:'Nhóm không hợp lệ.'});return;}
    if(msg.action==='stop-all')interactionEpoch++;
    serial(async()=>{
      if(['pick-header','pick-pane','pick-entry'].includes(msg.action)){pick(msg.group,msg.action==='pick-header'?'header':msg.action==='pick-entry'?'entry':'pane');return {};}
      if(msg.action==='scan-both'||msg.action==='watch-both'){
        try{await scanBoth();const s=await load();s.autoScan=msg.action==='watch-both';for(const g of ['58','145'])s.groups[g].watch=false;await save(s);return {};}
        catch(e){const s=await load();s.autoScan=false;s.scanStatus=errors[e.message]||e.message||'Quét đã dừng.';await save(s);throw e;}
      }
      if(msg.action==='stop-all'){const s=await load();s.autoScan=false;for(const g of ['58','145'])if(s.groups[g])s.groups[g].watch=false;s.scanStatus='Đã dừng theo dõi.';await save(s);return {};}

      if(msg.action==='capture')return safelyCapture(msg.group);
      if(msg.action==='watch'){const s=await load();if(!s.groups[msg.group]?.header||!s.groups[msg.group]?.pane)throw Error('SELECTOR_CHANGED');await safelyCapture(msg.group);const fresh=await load();fresh.groups[msg.group].watch=true;await save(fresh);return {};}
      if(msg.action==='stop'){const s=await load();if(s.groups[msg.group])s.groups[msg.group].watch=false;await save(s);return {};}
      if(msg.action==='clear'){const s=await load();delete s.groups[msg.group];delete s.status[msg.group];s.snapshots=s.snapshots.filter(x=>x.group!==msg.group);await save(s);return {};}
      throw Error('Lệnh không hợp lệ.');
    }).then(value=>reply({ok:true,...value})).catch(err=>reply({ok:false,error:errors[err.message]||err.message}));
    return true;
  });
  setInterval(()=>{
    if(selecting||document.hidden)return;
    void serial(async()=>{
      const s=await load();if(s.autoScan){if(Date.now()-lastScan>=30000){try{await scanBoth();}catch(e){const fresh=await load();fresh.autoScan=false;fresh.scanStatus=errors[e.message]||e.message||'Quét đã dừng.';await save(fresh);}}return;}for(const group of ['58','145'])if(s.groups[group]?.watch){try{await safelyCapture(group);}catch{/* Local status already explains pause; never send/retry writes. */}}
    }).catch(()=>{});
  },15000);
})();
