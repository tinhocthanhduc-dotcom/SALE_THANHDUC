'use strict';
const {chromium}=require('../../erp-prototype/node_modules/playwright'),{createApp}=require('../server.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'money-input-')),app=createApp(root),directory=app.auth.directory();let seq=0;
 const run=(type,payload,actor='dispatch')=>app.business.submit({type,payload,idempotency_key:'currency-'+seq++,expected_version:payload.order_id?app.business.snapshot().state.orders[payload.order_id].version:undefined},{actor:directory[actor],directory,now:()=>new Date().toISOString(),id:()=> 'currency-'+seq++,evidence_verified:true});
 const customer=run('create_customer',{name:'Currency fixture',phone:'0900000000',address:'Fixture'}).id;
 const order=run('create_order',{customer_id:customer,address:'Fixture',request:'Currency fixture',source:'hotline',priority:'normal',delivery_items:[{item:'Fixture goods',qty:1,unit_price:50000,warehouse:'58'}]}).id;
 const accepted=run('create_order',{customer_id:customer,address:'Fixture',request:'Accepted currency fixture',source:'hotline',priority:'normal',appointment_time_start:'08:00',appointment_time_end:'17:00',delivery_items:[{item:'Billing goods fixture',qty:1,unit_price:50000,warehouse:'58'}]}).id;
 run('assign',{order_id:accepted,technician_id:'tech1'});run('accept',{order_id:accepted},'tech1');
 const pending=app.business.snapshot().state.orders[accepted];run('pickup_delivery',{order_id:accepted,issue_id:pending.delivery_issues[0].id,pickup_confirmation:true,pickups:pending.parts_requests.map(r=>({request_id:r.id,qty:r.qty}))},'tech1');run('start',{order_id:accepted},'tech1');
 for(const kind of ['after','handover'])run('add_evidence',{order_id:accepted,kind,mime:'image/jpeg',file_id:'fixture-'+kind},'tech1');
 run('complete',{order_id:accepted,work_summary:'Fixture completed',customer_agreed:true,part_usages:[{request_id:pending.parts_requests[0].id,used_qty:1}],usage_confirmed:true,charge_lines:[{kind:'labor',name:'Fixture labor',amount:50000}]},'tech1');
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.ERP_TEST_CHROMIUM?{executablePath:process.env.ERP_TEST_CHROMIUM}:{}),args:['--no-sandbox','--disable-dev-shm-usage']}),page=await browser.newPage({viewport:{width:390,height:844},permissions:['clipboard-read','clipboard-write']}),errors=[],scenarios=[];
 page.on('pageerror',err=>errors.push(err.message));
 try{
  await page.goto('http://127.0.0.1:'+app.server.address().port);await page.locator('#username').fill('director');await page.locator('#password').fill('DemoThanhDuc2026!');await page.locator('#login-button').click();await page.waitForFunction(()=>!document.getElementById('app').hidden);
  await page.locator('[data-page=payment_methods]').click();await page.locator('[data-form=configure_prices]').click();
  const field=page.locator('#threshold');await field.fill('');await field.pressSequentially('1250000');assert.equal(await field.inputValue(),'1.250.000');
  assert((await page.locator('.money-input-help').innerText()).includes('một triệu hai trăm năm mươi nghìn đồng'));
  const response=page.waitForResponse(async r=>r.request().method()==='POST'&&r.request().postDataJSON()?.command?.type==='configure_prices');
  await page.locator('#command-form [type=submit]').click();await response;await page.waitForFunction(()=>!document.getElementById('dialog').open);
  assert.equal(app.business.snapshot().state.price_policy.threshold,1250000);assert.equal(typeof app.business.snapshot().state.price_policy.threshold,'number');
  scenarios.push('typing 1250000 displays 1.250.000 with words and server receives integer 1250000');
  await page.locator('[data-form=configure_prices]').click();assert.equal(await field.inputValue(),'1.250.000');
  await field.evaluate(el=>{el.focus();el.setSelectionRange(2,3)});await field.press('3');assert.equal(await field.inputValue(),'1.350.000');assert.equal(await field.evaluate(el=>el.selectionStart),3);
  scenarios.push('middle digit replacement preserves caret rather than jumping to end');
  await field.fill('');await page.evaluate(()=>navigator.clipboard.writeText('50,000đ'));await field.press('Control+V');assert.equal(await field.inputValue(),'50.000');
  for(const text of ['50.000','50000đ','50 000']){await field.fill(text);assert.equal(await field.inputValue(),'50.000');}
  assert.equal(await page.locator('.money-input-help').innerText(),'năm mươi nghìn đồng');
  scenarios.push('clipboard and formatted VND variants normalize to 50.000');
  await field.fill('-50000');assert.equal(await field.evaluate(el=>el.checkValidity()),false);assert((await page.locator('.money-input-help').innerText()).includes('không được âm'));
  await field.fill('10000000001');assert.equal(await field.evaluate(el=>el.checkValidity()),false);await field.fill('10000000000');assert.equal(await field.evaluate(el=>el.checkValidity()),true);assert.equal(await page.locator('.money-input-help').innerText(),'mười tỷ đồng');
  await field.fill('');assert.equal(await field.evaluate(el=>el.checkValidity()),false);await field.fill('0');assert.equal(await page.locator('.money-input-help').innerText(),'không đồng');
  scenarios.push('required blank, negative, above 10 billion rejected; zero and exact ceiling readable');
  await field.fill('1250000');await field.evaluate(el=>el.setSelectionRange(1,1));await field.press('Delete');assert.equal(await field.inputValue(),'150.000');
  await field.fill('1250000');await field.evaluate(el=>el.setSelectionRange(2,2));await field.press('Backspace');assert.equal(await field.inputValue(),'250.000');
  scenarios.push('deleting across grouping separator does not trap caret or resurrect removed digit');
  await page.locator('[data-close]').click();await page.locator('[data-page=board]').click();await page.locator('[data-open="'+order+'"]').click();await page.locator('[data-form=edit_delivery_issue]').click();
  assert.equal(await page.locator('[data-delivery-price]').inputValue(),'50.000');assert.equal(await page.locator('[data-delivery-price]').getAttribute('type'),'text');
  assert.equal(await page.locator('[data-part-qty]').getAttribute('type'),'number');
  await page.locator('[data-delivery-price]').fill('1250000');await page.locator('#command-form [type=submit]').click();await page.waitForFunction(()=>!document.getElementById('dialog').open);
  assert.equal(app.business.snapshot().state.orders[order].parts_requests[0].unit_price,1250000);
  await page.locator('[data-form=set_delivery_prices]').click();assert.equal(await page.locator('[data-goods-price]').inputValue(),'1.250.000');
  scenarios.push('existing delivery/goods prices are formatted, quantities remain number and delivery sends integer price');
  await page.locator('[data-close]').click();await page.locator('[data-page=done]').click();await page.locator('[data-open="'+accepted+'"]').click();await page.locator('[data-form=revise_prices]').click();
  // Both charge and billing-goods adapters use the shared component even on desktop.
  assert.equal(await page.locator('[data-charge-amount]').first().inputValue(),'50.000');assert.equal(await page.locator('[data-goods-price]').inputValue(),'50.000');await page.locator('[data-add-charge]').click();assert.equal(await page.locator('[data-charge-amount]').first().getAttribute('type'),'text');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({pass:true,scenarios,page_errors:errors},null,2));
 }finally{await browser.close();await new Promise(r=>app.server.close(r));fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1)});
