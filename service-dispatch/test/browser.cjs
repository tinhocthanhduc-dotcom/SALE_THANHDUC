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
  await page.locator('[data-page="customers"]').click();
  await submit('create_customer',{name:'Khách browser mẫu',phone:'0901234000',address:'Địa chỉ giả',area:'Tuyến 1'});
  const customer=Object.values(app.business.snapshot().state.customers)[0];
  await submit('create_machine',{customer_id:customer.id,model:'Model giả'});
  const machine=Object.values(app.business.snapshot().state.machines)[0];
  await submit('create_order',{customer_id:customer.id,machine_id:machine.id,address:'Địa chỉ làm giả',request:'Máy không in',source:'zalo',priority:'urgent',appointment_start:'2026-10-13T09:00',appointment_end:'2026-10-13T10:00'});
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
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({pass:true,scenarios:['login server-side','create customer/machine/order','assign and accept','schedule/start','request and approve transfer','old technician denied','new technician accepts','upload private evidence','accept work','reload durability','authorized image','mobile layout'],page_errors:errors},null,2));
 }finally{await browser.close();await new Promise(r=>app.server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1);});
