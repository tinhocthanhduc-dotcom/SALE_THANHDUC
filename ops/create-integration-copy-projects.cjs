'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
function provision(){
const root=process.argv[2],registryFile=process.argv[3],request=require('./integration-copy-20261015.request.json');
const legacy=['1CPEo4X0m7zcuIa-OKGW8LSv056QcwGdXku_DFXQEpvajyTJhtP5BEFzu','1plq9ZhVsyDe8q1_sf_X0_LUEyOLu5TaMU_BAqVV8I1BE1pplpitOQ1BN','1k2pMSKKG1DF_r7p479O_VSZP3hOciVjCluZgoqM1pN7TOU0ArHeEgGZH','1yrLA1BaoJSCtF6RCFFF2-c_upUeReomxfJu3MdVSKPjxGe3owMN0LbP6','1RKhkCNMCPB_0P2AWhNYGyhBgYtCor5Q9gb8QCkHnmaDnTT58h4Taq2ql','16A5vFbfWwf7HUXmE0yFTYqg2fMjcv84TOHh_Pr9JWjJszqQrDUPAOO6N'];
let registry=fs.existsSync(registryFile)?JSON.parse(fs.readFileSync(registryFile,'utf8')):{request_id:request.request_id,copies:request.copies,projects:{}};
if(registry.request_id!==request.request_id||JSON.stringify(registry.copies)!==JSON.stringify(request.copies))throw Error('REGISTRY_MISMATCH');
const save=()=>fs.writeFileSync(registryFile,JSON.stringify(registry,null,2));
for(const kind of ['warehouse','finance']){
 const dir=path.join(root,kind),cfg=path.join(dir,'.clasp.json');let project=registry.projects[kind];
 if(!project){
  cp.execFileSync('clasp',['--json','create-script','--type','standalone','--title','DIEUPHOI_'+kind.toUpperCase()+'_COPY_20261015_01','--rootDir','.'],{cwd:dir,stdio:'pipe'});
  const created=JSON.parse(fs.readFileSync(cfg,'utf8'));if(!created.scriptId||legacy.includes(created.scriptId))throw Error('NEW_PROJECT_REQUIRED');
  project=registry.projects[kind]={script_id:created.scriptId,editor_url:'https://script.google.com/d/'+created.scriptId+'/edit',created_at:new Date().toISOString(),pushed:false};save();
 }
 if(!project.script_id||legacy.includes(project.script_id))throw Error('NEW_PROJECT_REQUIRED');
 if(Object.entries(registry.projects).some(([other,p])=>other!==kind&&p.script_id===project.script_id))throw Error('DUPLICATE_PROJECT_ID');
 fs.writeFileSync(cfg,JSON.stringify({scriptId:project.script_id,rootDir:'.'}));
 // create-script can generate a default manifest. Restore tested files after creating.
 for(const name of ['Code.gs','Index.html','appsscript.json'])fs.copyFileSync(path.join(root,kind+'-prepared',name),path.join(dir,name));
 fs.writeFileSync(path.join(dir,'.claspignore'),'**\n!Code.gs\n!Index.html\n!appsscript.json\n');
 cp.execFileSync('clasp',['--json','push','--force'],{cwd:dir,stdio:'pipe'});project.pushed=true;save();
 console.log(kind+': '+project.editor_url);
}

}
try{provision();}catch(error){console.error('COPY_CONSUMER_PROVISION_FAILED: stopped safely; inspect persisted project registry before retry. Private CLI output is not published.');process.exitCode=1;}
