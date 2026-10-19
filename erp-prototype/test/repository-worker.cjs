const {LocalRepository}=require('../local-repository.cjs');const crypto=require('node:crypto');
const [dir,key,crash]=process.argv.slice(2);
const repo=new LocalRepository(dir,{fault:phase=>{if(phase===crash)process.exit(70);}});
const context={actor:{id:'sale-fixture',role:'sales'},masters:{customers:{c:{active:true}},products:{p:{active:true,approved:true,name:'Fixture',unit:'Cái'}}},now:()=> '2026-10-12T03:00:00Z',id:()=>crypto.randomUUID()};
const command={type:'create',idempotency_key:key,payload:{customer_id:'c',lines:[{product_id:'p',qty:1,unit_price_vnd:10}]}};
let tries=0;
function run(){try{process.stdout.write(JSON.stringify(repo.submit(command,context)));}catch(e){if(e.code==='LOCK_BUSY'&&++tries<200)setTimeout(run,10);else{process.stderr.write(e.message);process.exitCode=1;}}}run();
