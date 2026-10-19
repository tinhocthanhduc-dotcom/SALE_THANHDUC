'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
for(const pair of [false,true])for(const fail of [false,true])test('API publication restores private HEAD; deployment failure='+fail+'; security pair='+pair,()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cd-deploy-'));
 try{
  const ui=path.join(tmp,'ui'),api=path.join(tmp,'api');for(const d of [ui,api])fs.mkdirSync(d);
  fs.writeFileSync(path.join(ui,'appsscript.json'),JSON.stringify({webapp:{access:'ANYONE'}}));
  fs.writeFileSync(path.join(api,'appsscript.json'),JSON.stringify({webapp:{access:'ANYONE_ANONYMOUS'}}));fs.writeFileSync(path.join(api,'Code.gs'),'var CD_API_ONLY_ = true;');
  const registry=path.join(tmp,'project.json'),out=path.join(tmp,'out.json'),log=path.join(tmp,'log');fs.writeFileSync(registry,JSON.stringify({script_id:'1L65AaP41TWcRK52PlOjHUdWj82NaEHh5CKgQ9nYyJ998CMjR-rMxkXTW',deployment_id:'private-ui'}));
  fs.writeFileSync(path.join(tmp,'clasp'),'#!/usr/bin/env node\nconst fs=require("fs");fs.appendFileSync(process.env.TEST_LOG,JSON.stringify({cwd:process.cwd(),args:process.argv.slice(2)})+"\\n");if(process.argv.includes("create-deployment")){if(process.env.TEST_FAIL==="1")process.exit(1);console.log(JSON.stringify({deploymentId:process.argv.includes("private-ui")?"private-ui":"new-api",versionNumber:9}));}\n',{mode:0o755});
  const r=spawnSync(process.execPath,[path.resolve(__dirname,'../deploy-api.cjs'),registry,ui,api,out,...(pair?['--update-private-ui']:[])],{env:{...process.env,PATH:tmp+path.delimiter+process.env.PATH,TEST_LOG:log,TEST_FAIL:fail?'1':'0'},encoding:'utf8'});
  assert.equal(r.status,fail?1:0);const calls=fs.readFileSync(log,'utf8').trim().split('\n').map(JSON.parse);assert.equal(calls[0].cwd,api);assert.equal(calls.at(-1).cwd,ui);if(pair&&!fail){assert(calls.at(-1).args.includes('private-ui'));assert.deepEqual(calls.at(-2).args,['push','--force']);assert.equal(JSON.parse(fs.readFileSync(out)).private_ui_version,9);}else assert.deepEqual(calls.at(-1).args,['push','--force']);assert.ok(!calls[1].args.includes('private-ui'));if(!fail)assert.equal(JSON.parse(fs.readFileSync(out)).deployment_id,'new-api');
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
