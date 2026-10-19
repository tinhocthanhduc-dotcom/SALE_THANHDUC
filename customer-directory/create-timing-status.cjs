'use strict';
const fs=require('node:fs');let raw={},err='';try{raw=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));}catch(ignore){}try{err=fs.readFileSync(process.argv[3],'utf8');}catch(ignore){}
const r=raw.response?.result||raw.response||raw.result||raw,ms=r.directory_fetch_ms??r.total_ms;
const measured=Number.isFinite(ms)&&r.replayed===true;
const diagnostic=JSON.stringify(raw)+' '+err,reason=diagnostic.includes('Unable to run script')?'NOT_AUTHORIZED':diagnostic.includes('Script function not found')?'NOT_FOUND':/OWNER_REQUIRED|OWNER_SETUP_REQUIRED/.test(diagnostic)?'OWNER_REQUIRED':'NO_VERIFIED_GOOGLE_TIMING';
const result={measured,environment:r.environment||'COPY_ONLY',target_ms:5000,...(measured?{elapsed_ms:ms,replay_ms:r.replay_ms,phases:r.phases||[],met_target:ms<5000}:{reason}),live_apps_changed:false};
fs.writeFileSync(process.argv[4],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
