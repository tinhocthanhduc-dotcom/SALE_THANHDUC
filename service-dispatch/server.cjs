'use strict';
// Local fixture runner. Never opens the production apps or Google Sheets.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {LocalRepository}=require('../erp-prototype/local-repository.cjs');
const Domain=require('./domain.cjs');const {Auth,createUser}=require('./auth.cjs');const {createService}=require('./service.cjs');
function createApp(directory){
 const business=new LocalRepository(path.join(directory,'business'),{domain:Domain});
 const authFiles=new LocalRepository(path.join(directory,'auth'));
 const store={lock:fn=>authFiles.lock(fn),read:()=>authFiles.load('auth.json',{users:{},sessions:{}}),write:s=>authFiles.atomic('auth.json',s)};
 const random=()=>crypto.randomBytes(16).toString('hex');
 if(!Object.keys(store.read().users).length){const users={};for(const [id,name,roles] of [['dispatch','Điều phối',['dispatcher']],['tech1','Kỹ thuật 1',['technician']],['tech2','Kỹ thuật 2',['technician']],['director','Giám đốc',['director']],['warehouse','Thủ kho',['warehouse']]])users[id]=createUser({id,username:id,name,roles,password:'DemoThanhDuc2026!',random});store.lock(()=>store.write({users,sessions:{}}));}
 const auth=new Auth({store,random});
 const images=path.join(directory,'images');fs.mkdirSync(images,{recursive:true});
 const files={save(mime,base64){const data=Buffer.from(base64,'base64');if(!data.length||data.length>400000)throw Error('INVALID_IMAGE');const valid=mime==='image/png'?data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):mime==='image/jpeg'?data[0]===255&&data[1]===216:data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP';if(!valid)throw Error('INVALID_IMAGE');const id=crypto.randomUUID();fs.writeFileSync(path.join(images,id),data,{flag:'wx',mode:0o600});fs.writeFileSync(path.join(images,id+'.mime'),mime,{flag:'wx',mode:0o600});return id;},remove(id){for(const suffix of ['','.mime'])fs.rmSync(path.join(images,id+suffix),{force:true});},read(id){return {mime:fs.readFileSync(path.join(images,id+'.mime'),'utf8'),data:fs.readFileSync(path.join(images,id))};}};
 const service=createService({auth,repository:business,files,now:()=>new Date().toISOString(),id:()=>crypto.randomUUID()});
 const server=http.createServer(async(req,res)=>{
  const respond=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
  res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
  try{
   const url=new URL(req.url,'http://127.0.0.1');
   if(req.method==='GET'&&url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(path.join(__dirname,'ui.html.txt')));return;}
   if(req.method==='GET'&&url.pathname==='/app.js'){res.setHeader('Content-Type','application/javascript');res.end(fs.readFileSync(path.join(__dirname,'ui.js.txt')));return;}
   if(req.method!=='POST'||url.pathname!=='/api'){respond(404,{error:'NOT_FOUND'});return;}
   const expectedOrigin='http://'+req.headers.host;if(req.headers.origin&&req.headers.origin!==expectedOrigin){respond(403,{error:'FORBIDDEN'});return;}
   let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>600000){respond(413,{error:'BODY_TOO_LARGE'});req.destroy();return;}}
   const input=JSON.parse(raw),token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('dispatch_session='))?.slice('dispatch_session='.length);
   if(input.action==='login'){const result=service.login(input.username,input.password);res.setHeader('Set-Cookie','dispatch_session='+result.token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800');respond(200,{actor:result.actor});return;}
   if(input.action==='logout'){service.logout(token);res.setHeader('Set-Cookie','dispatch_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');respond(200,{ok:true});return;}
   let result;
   if(input.action==='query')result=service.query(token,input.order_id);
   else if(input.action==='command')result=service.command(token,input.command);
   else if(input.action==='upload')result=service.upload(token,input.payload);
   else if(input.action==='image'){const file=service.image(token,input.order_id,input.evidence_id);result={mime:file.mime,base64:file.data.toString('base64')};}
   else{respond(400,{error:'UNKNOWN_ACTION'});return;}
   respond(200,result);
  }catch(e){const error=e.code||(['INVALID_IMAGE'].includes(e.message)?e.message:'SERVER_ERROR');respond(['AUTH_REQUIRED','INVALID_LOGIN'].includes(error)?401:error==='FORBIDDEN'?403:400,{error});}
 });
 return {server,service,auth,business,store};
}
if(require.main===module){const dir=process.env.DISPATCH_FIXTURE_DIR||path.join(require('node:os').tmpdir(),'thanhduc-dispatch-fixture');if(!path.isAbsolute(dir))throw Error('ABSOLUTE_PATH_REQUIRED');const port=Number(process.env.DISPATCH_PORT||8787);const app=createApp(dir);app.server.listen(port,'127.0.0.1',()=>console.log('Local fixture server started on port '+port+'. See README for synthetic accounts.'));}
module.exports={createApp};
