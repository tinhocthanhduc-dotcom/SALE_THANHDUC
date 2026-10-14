'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {fixture}=require('../service-dispatch/integration/native-fixture.cjs'),path=require('node:path'),root=path.resolve(process.argv[2]),ids=JSON.parse(fs.readFileSync(path.join(root,'copy-ids.json'),'utf8'));
const reports=[];
for(const kind of ['warehouse','finance']){
 const f=fixture(kind);
 for(const [name,id] of Object.entries(ids)){const old=f.props['DISPATCH_COPY_'+name+'_ID'];if(f.books[old]){f.books[id]=f.books[old];f.books[id].id=id;}delete f.props['DISPATCH_COPY_'+name+'_ID'];}
 delete f.props.DISPATCH_COPY_TOKEN;delete f.props.DISPATCH_BRIDGE_HMAC;delete f.props.DISPATCH_BRIDGE_ENABLED;
 vm.createContext(f.box);vm.runInContext(fs.readFileSync(root+'/'+kind+'/Code.gs','utf8'),f.box);
 const incomplete=f.box.setupCopyConsumer();assert.equal(incomplete.consumer_enabled,false);assert.equal(incomplete.copy_markers_verified,false);assert.deepEqual(Array.from(incomplete.missing_properties),['DISPATCH_COPY_TOKEN','DISPATCH_BRIDGE_HMAC']);
 for(const [name,id] of Object.entries(ids))assert.equal(f.props['DISPATCH_COPY_'+name+'_ID'],id);
 f.props.DISPATCH_COPY_TOKEN='fixture-token';f.props.DISPATCH_BRIDGE_HMAC='SyntheticSecretOnly';assert.equal(f.box.setupCopyConsumer().copy_markers_verified,true);
 const logs=[];f.box.console.log=value=>logs.push(value);f.box.setupCopyConsumer();assert(!logs.join('').includes('SyntheticSecretOnly'));assert(!logs.join('').includes('fixture-token'));
 f.props.DISPATCH_COPY_TOKEN='wrong-marker';assert.throws(()=>f.box.enableCopyConsumer(),/INTEGRATION_COPY_REQUIRED/);assert.equal(f.props.DISPATCH_BRIDGE_ENABLED,'false');f.props.DISPATCH_COPY_TOKEN='fixture-token';
 let triggers=[];f.box.ScriptApp={getProjectTriggers:()=>triggers,newTrigger:handler=>({timeBased:()=>({everyMinutes:n=>({create:()=>{assert.equal(n,5);triggers.push({getHandlerFunction:()=>handler,getUniqueId:()=> 'fixture-trigger'});}})})})};
 if(kind==='warehouse')f.box.coreReadRoleRowsV109_=()=>[];else f.box.getCurrentUser_=()=>({role:'NHAN_VIEN'});
 assert.throws(()=>f.box.enableCopyConsumer(),/FORBIDDEN/);assert.equal(f.props.DISPATCH_BRIDGE_ENABLED,'false');assert.equal(triggers.length,0);
 if(kind==='warehouse')f.box.coreReadRoleRowsV109_=()=>[{enabled:true,type:'EMAIL',principal:'owner@example.test',role:'ADMIN'}];else f.box.getCurrentUser_=()=>({role:'ADMIN'});
 f.box.enableCopyConsumer();f.box.enableCopyConsumer();assert.equal(triggers.length,1);assert.equal(f.props.DISPATCH_BRIDGE_ENABLED,'true');
 f.props.DISPATCH_COPY_OUTBOX_ID='unapproved-other-copy';assert.throws(()=>f.box.setupCopyConsumer(),/INTEGRATION_COPY_ID_MISMATCH/);
 reports.push({consumer:kind,bootstrap_without_secrets:true,correct_ids_only:true,marker_required:true,no_secret_logging:true,permissions_required:true,trigger_once:true});
}
console.log(JSON.stringify({pass:true,google_projects_created:false,google_copy_uat:false,results:reports},null,2));
