'use strict';
const fs=require('node:fs'),path=require('node:path');
const request=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),source=path.resolve(process.argv[3]),root=path.resolve(process.argv[4]);
const ids=request.copies,required=['KHO58','KHO145','FINANCE','OUTBOX'];
if(!ids||Object.keys(ids).length!==4||required.some(k=>!/^[-A-Za-z0-9_]{20,100}$/.test(ids[k]||''))||new Set(Object.values(ids)).size!==4)throw Error('INVALID_COPY_REGISTRY');
const legacy=require('../service-dispatch/integration/catalogue.cjs').LEGACY_IDS;
if(Object.values(ids).some(id=>legacy.includes(id)))throw Error('LIVE_COPY_ID_REJECTED');
if(root.startsWith(path.resolve(__dirname,'..')+path.sep))throw Error('OUTPUT_MUST_BE_OUTSIDE_CHECKOUT');
fs.mkdirSync(root,{recursive:true});
fs.writeFileSync(path.join(root,'copy-ids.json'),JSON.stringify(ids,null,2));
for(const kind of ['warehouse','finance']){
 const dir=path.join(root,kind);fs.mkdirSync(dir,{recursive:true});
 let code=fs.readFileSync(path.join(source,kind,'Code.gs'),'utf8');
 const old="function dispatchBridgeCopyId_(kind){var p=PropertiesService.getScriptProperties(),id=p.getProperty('DISPATCH_COPY_'+kind.toUpperCase()+'_ID');if(!id||DispatchIntegration.LEGACY_IDS.indexOf(id)>=0)throw new Error('INTEGRATION_COPY_REQUIRED');return id;}";
 if(!code.includes(old))throw Error('TRANSPORT_CONTRACT_CHANGED');
 const replacement="function dispatchBridgeCopyId_(kind){var name=kind.toUpperCase(),expected=DISPATCH_PINNED_COPIES[name],actual=PropertiesService.getScriptProperties().getProperty('DISPATCH_COPY_'+name+'_ID');if(!expected||DispatchIntegration.LEGACY_IDS.indexOf(expected)>=0)throw new Error('INTEGRATION_COPY_REQUIRED');if(actual&&actual!==expected)throw new Error('INTEGRATION_COPY_ID_MISMATCH');return expected;}";
 code='var DISPATCH_PINNED_COPIES='+JSON.stringify(ids)+';\n'+code.replace(old,replacement);
 if(kind==='finance'){
  const target="EVIDENCE_FOLDER_ID: dispatchBridgeCopyId_('financeEvidence')";
  if(!code.includes(target))throw Error('FINANCE_FOLDER_CONTRACT_CHANGED');
  // Receipt images remain private in Dispatch. This receiver never uploads them to Finance.
  code=code.replace(target,"EVIDENCE_FOLDER_ID: ''");
 }
 code+=`\n/** Owner-only bootstrap for these exact copy IDs. Never copies/prints a secret. */
function setupCopyConsumer(){
 dispatchBridgeOwner_();var props=PropertiesService.getScriptProperties();Object.keys(DISPATCH_PINNED_COPIES).forEach(function(name){dispatchBridgeCopyId_(name);props.setProperty('DISPATCH_COPY_'+name+'_ID',DISPATCH_PINNED_COPIES[name]);});
 if(props.getProperty('DISPATCH_BRIDGE_ENABLED')===null)props.setProperty('DISPATCH_BRIDGE_ENABLED','false');
 var missing=['DISPATCH_COPY_TOKEN','DISPATCH_BRIDGE_HMAC'].filter(function(name){return !props.getProperty(name);});
 if(!missing.length){dispatchBridgeBook_('outbox');${kind==='warehouse'?"dispatchBridgeBook_('kho58');dispatchBridgeBook_('kho145');":"dispatchBridgeBook_('finance');"}}
 var report={copy_ids_configured:true,missing_properties:missing,copy_markers_verified:missing.length===0,consumer_enabled:props.getProperty('DISPATCH_BRIDGE_ENABLED')==='true',permission_check_required:true};console.log(JSON.stringify(report));return report;
}
function enableCopyConsumer(){
 dispatchBridgeOwner_();var report=setupCopyConsumer();if(report.missing_properties.length)throw new Error('COPY_TOKEN_AND_HMAC_REQUIRED');
 ${kind==='warehouse'?"var email=String(Session.getActiveUser().getEmail()).toLowerCase(),principal=coreReadRoleRowsV109_().find(function(r){return r.enabled&&r.type==='EMAIL'&&String(r.principal).toLowerCase()===email;});if(!principal||!(coreRoleAllows_(principal.role,'INVENTORY_OUT')||coreRoleAllows_(principal.role,'INVENTORY_IN')))throw new Error('FORBIDDEN');":"var user=getCurrentUser_();if(!['ADMIN','KE_TOAN'].includes(user.role))throw new Error('FORBIDDEN');"}
 var props=PropertiesService.getScriptProperties(),previous=props.getProperty('DISPATCH_BRIDGE_ENABLED');try{props.setProperty('DISPATCH_BRIDGE_ENABLED','true');var result=installDispatchConsumer();console.log(JSON.stringify(result));return result;}catch(error){if(previous===null)props.deleteProperty('DISPATCH_BRIDGE_ENABLED');else props.setProperty('DISPATCH_BRIDGE_ENABLED',previous);throw error;}
}
`;
 fs.writeFileSync(path.join(dir,'Code.gs'),code);
 for(const name of ['Index.html','appsscript.json'])fs.copyFileSync(path.join(source,kind,name),path.join(dir,name));
}
console.log('Prepared exact-ID copy packages; no secrets embedded, no remote writes.');
