from pathlib import Path

path = Path('Index.html')
text = path.read_text(encoding='utf-8')

marker = '/* TD_UX_UI_GLOBAL_V1 */'
if marker in text:
    print('UX/UI global patch already applied.')
    raise SystemExit(0)

css = r'''

/* TD_UX_UI_GLOBAL_V1 */
:root{
  --p:#0f766e;
  --p2:#115e59;
  --p-soft:#e8f6f4;
  --bg:#f3f6f8;
  --surface:#ffffff;
  --line:#d9e2e7;
  --line-strong:#c8d4da;
  --txt:#17212b;
  --muted:#64748b;
  --red:#b42318;
  --amber:#9a6700;
  --radius:14px;
  --shadow:0 8px 24px rgba(15,23,42,.07);
  --shadow-soft:0 2px 8px rgba(15,23,42,.05);
}

html{scroll-behavior:smooth}
body{
  min-width:320px;
  background:linear-gradient(180deg,#f8fafb 0,#f3f6f8 180px,#f3f6f8 100%);
  font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;
  line-height:1.45;
}

header{
  position:sticky;
  top:0;
  z-index:40;
  height:68px;
  padding:0 22px;
  box-shadow:0 2px 12px rgba(15,23,42,.12);
}
header>div:first-child{line-height:1.25;letter-spacing:.1px}
header>div:first-child b{font-size:16px;letter-spacing:.35px}
header>div:first-child small{opacity:.88;font-size:12px}
header .light{
  min-height:38px;
  border-color:rgba(255,255,255,.4);
  background:rgba(255,255,255,.95);
  color:var(--p2);
  box-shadow:0 2px 8px rgba(0,0,0,.08);
}

.shell{
  grid-template-columns:224px minmax(0,1fr);
  min-height:calc(100vh - 68px);
}
nav{
  position:sticky;
  top:68px;
  align-self:start;
  height:calc(100vh - 68px);
  overflow:auto;
  padding:14px 10px;
  border-right:1px solid var(--line);
  box-shadow:2px 0 12px rgba(15,23,42,.035);
}
nav button{
  min-height:44px;
  margin:3px 0;
  padding:10px 12px;
  border:1px solid transparent;
  border-radius:10px;
  font-size:13px;
  line-height:1.25;
  transition:background .16s ease,color .16s ease,border-color .16s ease,transform .16s ease;
}
nav button:hover{
  border-color:#cde6e2;
  background:#eef9f7;
  transform:translateX(1px);
}
nav button.active{
  background:var(--p-soft);
  color:var(--p2);
  border-color:#c8e7e2;
  box-shadow:inset 3px 0 0 var(--p);
}

main{
  width:100%;
  max-width:1680px;
  margin:0 auto;
  padding:20px 22px 32px;
}
.page.active{animation:tdPageIn .16s ease-out}
@keyframes tdPageIn{from{opacity:.45;transform:translateY(2px)}to{opacity:1;transform:none}}

.card{
  border-color:var(--line);
  border-radius:var(--radius);
  box-shadow:var(--shadow-soft);
  background:var(--surface);
}
.card:hover{box-shadow:var(--shadow)}
.head{
  min-height:50px;
  padding:13px 16px;
  background:linear-gradient(180deg,#fff,#fbfcfd);
}
.head>b{font-size:14px;color:#243442}
.body{padding:16px}
.grid{gap:14px}

input,select,textarea{
  min-height:40px;
  border-color:var(--line-strong);
  background:#fff;
  color:var(--txt);
  transition:border-color .15s ease,box-shadow .15s ease,background .15s ease;
}
textarea{min-height:78px;resize:vertical}
input:hover,select:hover,textarea:hover{border-color:#aebfc8}
input:focus,select:focus,textarea:focus{
  outline:none;
  border-color:#4aa99e;
  box-shadow:0 0 0 3px rgba(15,118,110,.12);
  background:#fff;
}
input::placeholder,textarea::placeholder{color:#94a3b8}

button{
  min-height:38px;
  transition:filter .15s ease,transform .12s ease,box-shadow .15s ease;
}
button:hover:not(:disabled){filter:brightness(.97);box-shadow:0 3px 9px rgba(15,23,42,.09)}
button:active:not(:disabled){transform:translateY(1px)}
button:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(15,118,110,.18)}
button.light:hover:not(:disabled){background:#f8fafc}
button.red:hover:not(:disabled){background:#ffe8e7}

.field{gap:6px}
.field label{font-size:12px;color:#3b4a58}
.field small{font-size:11px;color:#718096}
.form{gap:12px}
.form-section-title{font-size:13px;letter-spacing:.1px}

.toolbar,.quote-toolbar-grid,.quote-list-toolbar{margin-bottom:12px}
.toolbar{align-items:center}
.toolbar input{min-width:260px}

.table{
  border-color:var(--line);
  border-radius:11px;
  background:#fff;
  box-shadow:inset 0 1px 0 rgba(15,23,42,.02);
}
table{font-size:13px}
th,td{padding:10px 10px}
th{
  z-index:2;
  background:#edf7f5;
  color:#30434f;
  font-size:12px;
  letter-spacing:.05px;
  border-bottom:1px solid #cfe1de;
}
tbody tr{transition:background .12s ease}
tbody tr:hover{background:#f8fbfb}
tbody tr:last-child td{border-bottom:0}

.status{padding:4px 8px;border:1px solid #cce6e1}
.status.cancelled{border-color:#fecaca}
.status.updated{border-color:#d9ddff}
.group-pill{border:1px solid #cfe5e1}

.cart-box{
  border-color:var(--line);
  border-radius:12px;
  box-shadow:var(--shadow-soft);
}
.cart-head{padding:11px 13px;background:#f7fbfb}
.cart-count{border:1px solid #cce7e2}
.cart-row{padding:11px 13px}
.cart-row:hover{background:#fbfdfd}
.empty-cart{padding:38px 18px;font-size:13px}
.summary{
  margin-top:14px;
  padding:12px 4px 0;
  border-top:1px solid var(--line);
}
.sumrow{padding:6px 2px;gap:18px}
.grand{font-size:20px}
.action-row{
  gap:9px;
  padding-top:2px;
}
.action-row button{min-height:42px}

.quote-edit-banner{
  padding:11px 13px;
  border-radius:10px;
  box-shadow:0 2px 8px rgba(154,75,0,.05);
}
.vat-policy-card{border-radius:9px}

.modal{
  z-index:80;
  backdrop-filter:blur(2px);
}
.dialog{
  border:1px solid rgba(255,255,255,.7);
  border-radius:16px;
  box-shadow:0 24px 70px rgba(15,23,42,.24);
}
.modal-actions{padding-top:4px}
.toast{
  z-index:100;
  max-width:min(420px,calc(100vw - 28px));
  right:18px;
  bottom:18px;
  padding:12px 15px;
  border-radius:10px;
  box-shadow:0 10px 30px rgba(15,23,42,.2);
  pointer-events:none;
}

/* Tạo báo giá: ưu tiên không gian cho giỏ hàng và phần tổng tiền. */
#quote>.grid.two{
  grid-template-columns:minmax(420px,.92fr) minmax(560px,1.08fr);
  align-items:start;
}
#quote>.grid.two>.card:first-child{
  position:sticky;
  top:88px;
}
#quote .table{max-height:calc(100vh - 210px)}
#quote .cart{max-height:420px}
#quote .summary .grand{
  margin-top:3px;
  padding-top:8px;
  border-top:1px dashed #b9c8cf;
}

/* Sản phẩm: giữ cột quản lý nhóm dễ quan sát khi danh sách dài. */
.product-admin-layout{gap:14px;align-items:start}
.product-admin-layout>div:last-child{position:sticky;top:88px}
.group-table{max-height:520px}

/* Lịch sử báo giá: bộ lọc rõ ràng hơn và thao tác không bị chen chúc. */
.quote-list-toolbar{
  grid-template-columns:minmax(260px,1fr) 155px 155px 155px auto;
  align-items:end;
}
.row-actions{gap:6px;align-items:center}
.row-actions .mini{min-height:32px;padding:6px 9px}

@media(max-width:1280px){
  .shell{grid-template-columns:205px minmax(0,1fr)}
  main{padding:18px}
  #quote>.grid.two{grid-template-columns:1fr}
  #quote>.grid.two>.card:first-child{position:static}
  #quote .table{max-height:460px}
  .product-admin-layout>div:last-child{position:static}
}

@media(max-width:900px){
  header{height:auto;min-height:62px;padding:10px 14px;gap:10px}
  header>div:first-child small{display:none}
  .shell{display:block;min-height:calc(100vh - 62px)}
  nav{
    position:sticky;
    top:62px;
    z-index:30;
    height:auto;
    display:flex;
    gap:6px;
    overflow-x:auto;
    overflow-y:hidden;
    padding:8px 10px;
    border-right:0;
    border-bottom:1px solid var(--line);
    box-shadow:0 3px 10px rgba(15,23,42,.05);
  }
  nav button{
    width:auto;
    min-width:max-content;
    min-height:38px;
    margin:0;
    padding:8px 11px;
  }
  nav button.active{box-shadow:inset 0 -3px 0 var(--p)}
  main{padding:14px 12px 24px}
  .body{padding:13px}
  .head{padding:11px 13px}
  .two,.product-admin-layout{grid-template-columns:1fr}
  .quote-list-toolbar{grid-template-columns:1fr 1fr}
  .quote-list-toolbar input:first-child{grid-column:1/-1}
}

@media(max-width:620px){
  header>div:first-child b{font-size:14px}
  header .light{padding:8px 10px;font-size:12px}
  main{padding:10px 8px 20px}
  .card{border-radius:11px}
  .form{grid-template-columns:1fr}
  .wide,.field.wide{grid-column:auto}
  .quote-toolbar-grid,.quote-list-toolbar{grid-template-columns:1fr}
  .quote-list-toolbar input:first-child{grid-column:auto}
  .toolbar>*{width:100%}
  .toolbar input{min-width:0}
  .cart-row{
    grid-template-columns:minmax(0,1fr) 98px 108px 38px;
    gap:6px;
    padding:9px;
  }
  .cart-row .amount{grid-column:2/4}
  .action-row button{flex:1 1 100%}
  .sumrow{font-size:13px}
  .grand{font-size:18px}
  .dialog{border-radius:12px}
  .modal{padding:10px}
  .toast{right:10px;bottom:10px}
}
'''

needle = '</style>'
if needle not in text:
    raise SystemExit('Missing </style> in Index.html')

text = text.replace(needle, css + '\n' + needle, 1)
path.write_text(text, encoding='utf-8')
print('Applied global UX/UI optimization layer.')
