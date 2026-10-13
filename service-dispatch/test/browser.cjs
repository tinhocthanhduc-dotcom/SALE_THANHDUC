'use strict';
const {chromium}=require('../../erp-prototype/node_modules/playwright');
const {createApp}=require('../server.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dispatch-browser-')),app=createApp(dir);
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+app.server.address().port;
 const browser=await chromium.launch(process.env.ERP_TEST_CHROMIUM?{headless:true,executablePath:process.env.ERP_TEST_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process']}:{headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const login=async(username)=>{await page.locator('#username').fill(username);await page.locator('#password').fill('DemoThanhDuc2026!');await page.locator('#login-form button').click();await page.waitForFunction(()=>!document.getElementById('app').hidden);};
 const logout=async()=>{await page.locator('[data-logout]').click();await page.waitForFunction(()=>!document.getElementById('login').hidden);};
 const submit=async(type,values={})=>{await page.locator(`[data-form="${type}"]`).click();for(const [key,value] of Object.entries(values)){const element=page.locator('#'+key);if(await element.evaluate(e=>e.tagName==='SELECT'))await element.selectOption(value);else await element.fill(value);}await page.locator('#command-form button.primary').click();await page.waitForFunction(()=>!document.getElementById('dialog').open);};
 try{
  await page.goto(base);await login('dispatch');
  await page.locator('[data-form="create_order"]').click();
  assert.equal(await page.locator('#customer_id').inputValue(),'');assert.equal(await page.locator('#machine_id').isDisabled(),true);
  await page.locator('#address').fill('Địa chỉ làm giả');await page.locator('#request').fill('Máy không in');await page.locator('#source').selectOption('zalo');await page.locator('#priority').selectOption('urgent');await page.locator('#appointment_start').fill('2026-10-13T09:00');await page.locator('#appointment_end').fill('2026-10-13T10:00');
  const originalKey=await page.locator('#command-form').getAttribute('data-key');
  await page.locator('[data-inline-customer]').click();
  for(const [key,value] of Object.entries({name:'Khách browser mẫu',phone:'0901234000',address:'Địa chỉ khách mặc định',area:'Tuyến 1'}))await page.locator('#'+key).fill(value);
  await page.locator('#command-form button.primary').click();await page.waitForFunction(()=>document.getElementById('command-form')?.dataset.type==='create_order');
  const customer=Object.values(app.business.snapshot().state.customers)[0];
  assert.equal(await page.locator('#customer_id').inputValue(),customer.id);assert.equal(await page.locator('#request').inputValue(),'Máy không in');assert.equal(await page.locator('#address').inputValue(),'Địa chỉ làm giả');assert.equal(await page.locator('#source').inputValue(),'zalo');assert.equal(await page.locator('#command-form').getAttribute('data-key'),originalKey);
  await page.locator('[data-inline-machine]').click();assert.equal(await page.locator('#customer_id').inputValue(),customer.id);await page.locator('#model').fill('Model giả');await page.locator('#command-form button.primary').click();await page.waitForFunction(()=>document.getElementById('command-form')?.dataset.type==='create_order');
  const machine=Object.values(app.business.snapshot().state.machines)[0];assert.equal(await page.locator('#machine_id').inputValue(),machine.id);assert.equal(await page.locator('#request').inputValue(),'Máy không in');assert.equal(await page.locator('#appointment_start').inputValue(),'2026-10-13T09:00');
  await page.locator('[data-inline-customer]').click();await page.locator('[data-close]').click();assert.equal(await page.locator('#request').inputValue(),'Máy không in');assert.equal(await page.locator('#machine_id').inputValue(),machine.id);
  await page.locator('#command-form button.primary').click();await page.waitForFunction(()=>!document.getElementById('dialog').open);
  const order=Object.values(app.business.snapshot().state.orders)[0];assert.match(order.order_no,/^TD-\d{8}-0001$/);
  await submit('assign',{technician_id:'tech1'});await logout();await login('tech1');await page.locator(`[data-open="${order.id}"]`).click();
  assert.equal(await page.locator('[data-form="assign"]').count(),0);await submit('accept');
  await submit('schedule',{start:'2026-10-13T09:00',end:'2026-10-13T10:00',customer_confirmation:'Khách đồng ý 9 giờ'});await submit('start');
  await submit('request_transfer',{technician_id:'tech2',reason:'Thợ 1 không kịp, cần thợ 2 tiếp tục'});
  assert.equal(app.business.snapshot().state.orders[order.id].technician_id,'tech1');
  await logout();await login('dispatch');await page.locator(`[data-open="${order.id}"]`).click();
  await submit('approve_transfer',{handover_plan:'Chưa có vật tư/tiền; báo khách thợ mới'});
  await logout();await login('tech1');assert.equal(await page.locator('[data-open]').count(),0);
  const denied=await page.evaluate(async id=>{const response=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'query',order_id:id})});return response.status;},order.id);assert.equal(denied,403);
  await logout();await login('tech2');await page.locator(`[data-open="${order.id}"]`).click();await submit('accept');
  await submit('schedule',{start:'2026-10-13T11:00',end:'2026-10-13T12:00',customer_confirmation:'Khách đồng ý thợ mới',reason:'Chuyển thợ'});await submit('start');
  const base64=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=20;canvas.getContext('2d').fillRect(0,0,20,20);return canvas.toDataURL('image/png').split(',')[1];});
  for(const kind of ['after','handover']){await page.locator('#kind').selectOption(kind);await page.locator('#image-file').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:Buffer.from(base64,'base64')});await page.locator('#upload-form button').click();await page.waitForFunction(n=>document.querySelectorAll('[data-image]').length===n,kind==='after'?1:2);}
  await submit('complete',{work_summary:'Đã kiểm tra, in thử, khách nghiệm thu mẫu'});
  const result=app.business.snapshot().state.orders[order.id];assert.equal(result.status,'accepted_work');assert.equal(result.assignments.length,2);assert.equal(result.visits.length,2);assert.equal(result.evidence.length,2);assert.equal(result.dossier_status,'awaiting_reconciliation');
  await page.reload();await page.waitForFunction(()=>!document.getElementById('app').hidden);await page.locator(`[data-open="${order.id}"]`).click();assert((await page.locator('#detail').textContent()).includes('Đã nghiệm thu'));
  await page.locator('[data-image]').first().click();await page.waitForSelector('#image-view img');
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  // A second customer's machine must never appear under the first customer.
  await logout();await login('dispatch');await page.locator('[data-page="customers"]').click();
  await submit('create_customer',{name:'Khách khác mẫu',phone:'0901234999',address:'Địa chỉ khác',area:'Tuyến 2'});
  const other=Object.values(app.business.snapshot().state.customers).find(c=>c.id!==customer.id);
  await submit('create_machine',{customer_id:other.id,model:'Máy của khách khác'});
  await page.locator('[data-form="create_order"]').click();await page.locator('#customer-search').fill('0901234000');assert.equal(await page.locator('#customer_id option').count(),2);await page.locator('#customer_id').selectOption(customer.id);assert.equal(await page.locator('#machine_id option').count(),2);assert.equal(await page.locator('#machine_id').textContent().then(t=>t.includes('Máy của khách khác')),false);assert.equal(await page.locator('#address').inputValue(),'Địa chỉ khách mặc định');
  await page.locator('#address').fill('Địa chỉ công việc riêng');await page.locator('#customer-search').fill('');await page.locator('#customer_id').selectOption(other.id);assert.equal(await page.locator('#address').inputValue(),'Địa chỉ công việc riêng');assert.equal(await page.locator('#machine_id').inputValue(),'');await page.locator('[data-close]').click();
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({pass:true,scenarios:['login server-side','empty customer lists give inline creation','inline customer and machine retain order draft','inline cancel preserves draft','customer phone search and machine ownership filter','custom work address preserved','create customer/machine/order','assign and accept','schedule/start','request and approve transfer','old technician denied','new technician accepts','upload private evidence','accept work','reload durability','authorized image','mobile layout'],page_errors:errors},null,2));
 }finally{await browser.close();await new Promise(r=>app.server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1);});
