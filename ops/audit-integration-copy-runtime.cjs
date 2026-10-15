'use strict';
// Read-only runtime evidence. Never fetches sheet data, properties, logs, or tokens.
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),{createRequire}=require('node:module');
(async()=>{
 const tools=path.resolve(process.argv[2]),dest=process.argv[3],requireTools=createRequire(path.join(tools,'package.json')),{google}=requireTools('googleapis');
 const {initAuth}=await import(pathToFileURL(path.join(tools,'node_modules/@google/clasp/build/src/auth/auth.js')).href),auth=await initAuth({userKey:'default'});
 if(!auth.credentials)throw Error('EXISTING_GOOGLE_AUTH_REQUIRED');
 const api=google.script({version:'v1',auth:auth.credentials}),registry=require('../service-dispatch/docs/integration-20261015/projects.json');
 const projects={dispatch:{script_id:'1k2pMSKKG1DF_r7p479O_VSZP3hOciVjCluZgoqM1pN7TOU0ArHeEgGZH'},...registry.projects};
 const report={observed_at:new Date().toISOString(),read_only:true,properties_read:false,sheets_read:false,projects:{}};
 for(const [kind,p] of Object.entries(projects)){
  try{
   const r=await api.processes.listScriptProcesses({scriptId:p.script_id,pageSize:50,fields:'processes(functionName,processType,processStatus,startTime,duration),nextPageToken'});
   const allowed=new Set(['setupCopyConsumer','enableCopyConsumer','installDispatchConsumer','receiveFromDispatch','dispatchConsumerTick_','installDispatchOutboxPump','dispatchOutboxPump_']);
   report.projects[kind]={readable:true,executions:(r.data.processes||[]).filter(x=>allowed.has(x.functionName)).map(x=>({function:x.functionName,status:x.processStatus,type:x.processType,at:x.startTime,duration:x.duration})),more_pages:!!r.data.nextPageToken};
  }catch(e){report.projects[kind]={readable:false,http_status:Number(e.response?.status||e.code)||null,status:e.response?.data?.error?.status||'METADATA_UNAVAILABLE'};}
 }
 fs.writeFileSync(dest,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(()=>{console.error('READ_ONLY_RUNTIME_AUDIT_FAILED; credential details were not logged.');process.exitCode=1;});
