(() => {
  'use strict';
  if (location.origin !== 'https://chat.zalo.me' || window !== window.top || globalThis.__tdZaloProbe) return;
  globalThis.__tdZaloProbe = true;
  const C = globalThis.ZaloProbeCore, KEY = 'td-zalo-probe-v1';
  let chain = Promise.resolve(), selecting = false;
  const errors = {
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
  function path(el) {
    const parts = [];
    for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
      if (node.id && document.querySelectorAll('#' + CSS.escape(node.id)).length === 1) {parts.unshift('#' + CSS.escape(node.id)); break;}
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
    banner.textContent = (kind === 'header' ? 'Chọn đúng tên nhóm ở đầu cuộc trò chuyện.' : 'Chọn khung tin nhắn. ↑ mở rộng vùng, ↓ thu nhỏ.') + ' Bấm chuột để chốt · Esc hủy.';
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
          if(kind==='header') {const name=C.title(el.innerText);if(!name||name.length>160)throw Error('Hãy chọn riêng dòng tên nhóm.');config.header=path(el);config.name=name;}
          else {safePane(el);config.pane=path(el);}
          config.watch=false;s.groups[group]=config;s.status[group]={at:new Date().toISOString(),text:kind==='header'?'Đã chọn tên nhóm.':'Đã chọn khung tin.'};await save(s);
        } catch(err) {await status(group,errors[err.message]||err.message);}
      }).catch(()=>{});
    }
    window.addEventListener('mousemove',move,true);window.addEventListener('click',click,true);window.addEventListener('keydown',key,true);
  }
  async function capture(group) {
    const s=await load(),config=s.groups[group];
    if(document.hidden)throw Error('PAGE_HIDDEN');
    if(!config?.header||!config?.pane)throw Error('SELECTOR_CHANGED');
    const header=unique(config.header);if(!header.getClientRects().length||C.title(header.innerText)!==config.name)throw Error('GROUP_CHANGED');
    const pane=safePane(unique(config.pane));
    // Read rendered text of this selected pane only; do not access cookies,
    // private Zalo endpoints, input contents, images, or the rest of the page.
    const text=C.clean(pane.innerText);if(!text)throw Error('EMPTY_PANE');if(text.length>50000)throw Error('TOO_LARGE');
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(group+'\n'+config.name+'\n'+text));
    const digest=[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
    const item={kind:'loaded_dom_snapshot',group,name:config.name,captured_at:new Date().toISOString(),digest,text};
    const out=C.append(s,item);out.state.status[group]={at:item.captured_at,text:out.added?'Đã lưu bản đọc thử.':'Nội dung giống bản đã lưu; không lưu trùng.'};await save(out.state);
    return {added:out.added,characters:text.length};
  }
  async function safelyCapture(group) {try{return await capture(group);}catch(err){await status(group,errors[err.message]||'Không đọc được vùng đã chọn. Chọn lại vùng và thử lại.');throw err;}}
  chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
    if(!msg||msg.app!=='TD_ZALO_PROBE')return;
    if(!['58','145'].includes(msg.group)){reply({ok:false,error:'Nhóm không hợp lệ.'});return;}
    serial(async()=>{
      if(msg.action==='pick-header'||msg.action==='pick-pane'){pick(msg.group,msg.action==='pick-header'?'header':'pane');return {};}
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
      const s=await load();for(const group of ['58','145'])if(s.groups[group]?.watch){try{await safelyCapture(group);}catch{/* Local status already explains pause; never send/retry writes. */}}
    }).catch(()=>{});
  },15000);
})();
