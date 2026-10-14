'use strict';
// Exercise the built inline HTML in a sandboxed frame using the GAS callback contract.
const {chromium}=require('../../erp-prototype/node_modules/playwright');
const {createApp}=require('../server.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dispatch-gas-ui-')),app=createApp(path.join(root,'fixture')),build=path.join(root,'gas');
 cp.execFileSync(process.execPath,[path.join(__dirname,'../build-gas.cjs'),build]);const html=fs.readFileSync(path.join(build,'Index.html'),'utf8');
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const directory=app.auth.directory();let sequence=0;const run=(type,payload,who='dispatch')=>app.business.submit({type,payload,idempotency_key:'gas-ui-'+(++sequence),expected_version:payload.order_id?app.business.snapshot().state.orders[payload.order_id].version:undefined},{actor:directory[who],directory,now:()=> '2026-10-13T02:00:00Z',id:()=> 'gas-fixture-'+(++sequence)});
 const customer=run('create_customer',{name:'Legacy fixture customer',phone:'0900000001',address:'Fixture address'}).id;const machine=run('create_machine',{customer_id:customer,model:'Fixture machine'}).id;const order=run('create_order',{customer_id:customer,machine_id:machine,address:'Fixture address',request:'Fixture issue',source:'hotline',priority:'normal',appointment_start:'2026-10-13T03:00:00Z',appointment_end:'2026-10-13T04:00:00Z'}).order_id;run('assign',{order_id:order,technician_id:'tech1'});run('accept',{order_id:order},'tech1');run('start',{order_id:order},'tech1');run('wait_parts',{order_id:order,item:'Fixture Canon 3500',qty:1,reason:'Need machine'},'tech1');
 const browser=await chromium.launch(process.env.ERP_TEST_CHROMIUM?{headless:true,executablePath:process.env.ERP_TEST_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage']}:{headless:true});
 try{
  const context=await browser.newContext(),page=await context.newPage();let mode='normal',broken=false,strictCsp=false,loginCalls=0;const unexpected=[];
  page.on('pageerror',e=>{if(!broken)unexpected.push(e.message);});
  await context.exposeBinding('fixtureGasApi',(_,input)=>{
   if(input.action==='login'){loginCalls++;if(mode==='login_failure')throw Error('Fixture transport failure');return app.service.login(input.username,input.password);}
   if(input.action==='query'){if(input.token&&mode==='null_query')return null;if(input.token&&mode==='invalid_query')return {actor:null,orders:[]};return app.service.query(input.token,input.order_id);}
   if(input.action==='logout'){app.service.logout(input.token);return {ok:true};}
   throw Error('Unexpected fixture action');
  });
  await context.addInitScript(()=>{
   const runner=(success=()=>{},failure=()=>{})=>({withSuccessHandler:fn=>runner(fn,failure),withFailureHandler:fn=>runner(success,fn),dispatchApi:input=>window.fixtureGasApi(input).then(success,failure)});
   window.google={script:{run:runner()}};
  });
  await page.route(base+'/gas-host',r=>r.fulfill({contentType:'text/html',body:'<iframe id="gas" src="/gas-ui" sandbox="allow-scripts allow-forms allow-same-origin" style="width:100%;height:900px"></iframe>'}));
  await page.route(base+'/gas-ui',r=>{let content=broken?html.replace(/(<script id="dispatch-client-source" type="application\/json">)([\s\S]*?)(<\/script>)/,(match,start,payload,end)=>start+JSON.stringify(Buffer.from('function malformed( {'+Buffer.from(JSON.parse(payload),'base64').toString('utf8')).toString('base64'))+end):html;if(strictCsp)content=content.replace(/<script(?=[ >])/g,'<script nonce="fixture-nonce"');const encoded=JSON.stringify(content).replace(/</g,'\\u003c');return r.fulfill({contentType:'text/html',headers:strictCsp?{'Content-Security-Policy':"script-src 'nonce-fixture-nonce'; object-src 'none'"}:{},body:'<!doctype html><script'+(strictCsp?' nonce="fixture-nonce"':'')+'>document.open();document.write('+encoded+');document.close();</script>'});});
  async function open(){await page.goto(base+'/gas-host');await page.waitForSelector('#gas');const frame=await page.waitForFunction(()=>document.querySelector('#gas').contentWindow.location.pathname==='/gas-ui');await frame.dispose();return page.frames().find(f=>f.url()===base+'/gas-ui');}
  let ui=await open();await ui.waitForFunction(()=>!document.getElementById('login-button').disabled);
  const frameUrl=ui.url();await ui.locator('#username').fill('dispatch');await ui.locator('#password').fill('DemoThanhDuc2026!');await ui.locator('#login-button').click();await ui.waitForFunction(()=>!document.getElementById('app').hidden);assert.equal(ui.url(),frameUrl);assert.equal(loginCalls,1);assert.equal(await ui.locator('header').isVisible(),true);assert((await ui.locator('#view').textContent()).includes('Bảng điều phối'));await ui.locator('[data-open]').click();assert((await ui.locator('#detail').textContent()).includes('Chờ kho xử lý'));assert.equal(await ui.locator('header').isVisible(),true);
  if(await ui.locator('[data-page="account"]').count())await ui.locator('[data-page="account"]').click();await ui.locator('[data-logout]').click();await ui.waitForFunction(()=>!document.getElementById('login').hidden);await ui.locator('#username').fill('tech1');await ui.locator('#password').fill('DemoThanhDuc2026!');await ui.locator('#password').press('Enter');await ui.waitForFunction(()=>!document.getElementById('app').hidden);assert.equal(ui.url(),frameUrl);assert.equal(loginCalls,2);assert((await ui.locator('#view').textContent()).includes('Việc của tôi'));
  for(const failure of ['login_failure','null_query','invalid_query']){
   if(await ui.locator('[data-page="account"]').count())await ui.locator('[data-page="account"]').click();await ui.locator('[data-logout]').click();await ui.waitForFunction(()=>!document.getElementById('login').hidden);mode=failure;
   await ui.locator('#username').fill('dispatch');await ui.locator('#password').fill('DemoThanhDuc2026!');await ui.locator('#login-button').click();await ui.waitForFunction(()=>!document.getElementById('login-button').disabled);
   assert.equal(ui.url(),frameUrl);assert.equal(await ui.locator('header').isVisible(),true);assert.equal(await ui.locator('#login').isVisible(),true);assert((await ui.locator('#message').textContent()).length>0);
   if(failure!=='login_failure')assert((await ui.locator('#message').textContent()).includes('BAD_SERVER_RESPONSE'));
   mode='normal';await ui.locator('#password').fill('DemoThanhDuc2026!');await ui.locator('#login-button').click();await ui.waitForFunction(()=>!document.getElementById('app').hidden);
  }
  assert.deepEqual(unexpected,[]);broken=true;ui=await open();await ui.waitForFunction(()=>document.getElementById('message').textContent.includes('UI_RUNTIME_ERROR'));assert((await ui.locator('#message').textContent()).includes('SyntaxError'));assert.equal((await ui.locator('#message').textContent()).includes('DemoThanhDuc2026!'),false);assert.equal(await ui.locator('#login-button').isDisabled(),true);assert.equal(await ui.locator('header').isVisible(),true);assert.equal(await ui.locator('#login').isVisible(),true);
  broken=false;strictCsp=true;ui=await open();await ui.waitForFunction(()=>!document.getElementById('app').hidden);assert.equal(await ui.locator('#dispatch-client').evaluate(s=>s.nonce),'fixture-nonce');assert.equal(await ui.locator('header').isVisible(),true);assert.deepEqual(unexpected,[]);
  console.log(JSON.stringify({pass:true,scenarios:['built GAS inline HTML via document.write in sandbox frame','Google callback login does not navigate','existing waiting order renders with legacy fields','Enter logs in once','failed bridge preserves login and permits retry','null query stays visible with diagnostic','invalid query stays visible with diagnostic','bootstrap failure blocks native submission and shows error','dynamic client inherits nonce under strict CSP'],page_errors:unexpected},null,2));
 }finally{await browser.close();await new Promise(r=>app.server.close(r));fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1);});
