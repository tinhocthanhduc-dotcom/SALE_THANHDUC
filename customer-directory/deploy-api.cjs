'use strict';
// Owner-approved COPY API only. Never select a deployment by list order.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const [registry,uiDir,apiDir,out]=process.argv.slice(2),p=JSON.parse(fs.readFileSync(registry,'utf8'));
const expected='1L65AaP41TWcRK52PlOjHUdWj82NaEHh5CKgQ9nYyJ998CMjR-rMxkXTW';
if(p.script_id!==expected||!p.deployment_id)throw Error('COPY_PROJECT_REQUIRED');
const manifest=dir=>JSON.parse(fs.readFileSync(path.join(dir,'appsscript.json'),'utf8'));
if(manifest(uiDir).webapp.access!=='ANYONE'||manifest(apiDir).webapp.access!=='ANYONE_ANONYMOUS'||!fs.readFileSync(path.join(apiDir,'Code.gs'),'utf8').startsWith('var CD_API_ONLY_ = true;'))throw Error('API_PACKAGE_REQUIRED');
const pinFile=path.join(__dirname,'api.copy.json'),pin=fs.existsSync(pinFile)?JSON.parse(fs.readFileSync(pinFile,'utf8')):null;
if(pin&&(pin.script_id!==expected||!pin.deployment_id||pin.deployment_id===p.deployment_id))throw Error('SEPARATE_API_DEPLOYMENT_REQUIRED');
for(const dir of [uiDir,apiDir])fs.writeFileSync(path.join(dir,'.clasp.json'),JSON.stringify({scriptId:expected,rootDir:'.'}));
function clasp(args,cwd,json=false){return execFileSync('clasp',args,{cwd,encoding:'utf8',stdio:json?['ignore','pipe','pipe']:'inherit'});}
try{
 clasp(['push','--force'],apiDir);
 const args=['--json','create-deployment','--description','COPY signed DIEUPHOI API only; owner approved'];
 if(pin)args.push('--deploymentId',pin.deployment_id);
 const r=JSON.parse(clasp(args,apiDir,true)),id=r.deploymentId||pin?.deployment_id;
 if(!id||id===p.deployment_id)throw Error('SEPARATE_API_DEPLOYMENT_UNCONFIRMED');
 fs.writeFileSync(out,JSON.stringify({script_id:expected,deployment_id:id,version:r.versionNumber||null,web_app_url:'https://script.google.com/macros/s/'+id+'/exec',hmac_required:true,private_ui_deployment_id:p.deployment_id},null,2));
}finally{
 // Restore editor/HEAD source even if creation fails. Both immutable deployments stay pinned.
 clasp(['push','--force'],uiDir);
}

// Explicit security rollout updates the existing Google-authenticated UI as well.
if(process.argv.includes('--update-private-ui')){
 const result=JSON.parse(clasp(['--json','create-deployment','--deploymentId',p.deployment_id,'--description','COPY owner security dialogs; Google login required'],uiDir,true));
 if(result.deploymentId!==p.deployment_id)throw Error('PRIVATE_UI_DEPLOYMENT_UNCONFIRMED');
 const meta=JSON.parse(fs.readFileSync(out,'utf8'));meta.private_ui_version=result.versionNumber;fs.writeFileSync(out,JSON.stringify(meta,null,2));
}
