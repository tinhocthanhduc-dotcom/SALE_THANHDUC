'use strict';
// Local fixture persistence only. No Sheets API and no GAS deployment integration.
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const DefaultDomain=require('./order-work.cjs');
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
function fail(code){const e=new Error(code);e.code=code;throw e;}
class LocalRepository {
  constructor(directory,{fault=()=>{},domain=DefaultDomain}={}) {
    if(!path.isAbsolute(directory))fail('ABSOLUTE_FIXTURE_PATH_REQUIRED');
    this.directory=directory;this.fault=fault;this.domain=domain;
    fs.mkdirSync(directory,{recursive:true});
    const marker=path.join(directory,'FIXTURE_ONLY');
    try{fs.writeFileSync(marker,'THANHDUC_LOCAL_FIXTURE_ONLY\n',{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
    if(fs.readFileSync(marker,'utf8')!=='THANHDUC_LOCAL_FIXTURE_ONLY\n')fail('FIXTURE_MARKER_MISMATCH');
  }
  atomic(name,value) {
    const temp=path.join(this.directory,'.'+name+'.'+crypto.randomUUID()+'.tmp');
    const fd=fs.openSync(temp,'wx',0o600);
    try{fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    fs.renameSync(temp,path.join(this.directory,name));
    const dir=fs.openSync(this.directory,'r');try{fs.fsyncSync(dir);}finally{fs.closeSync(dir);}
  }
  load(name,fallback){try{return JSON.parse(fs.readFileSync(path.join(this.directory,name),'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
  lock(callback) {
    const lockPath=path.join(this.directory,'writer.lock');let fd;
    try{fd=fs.openSync(lockPath,'wx',0o600);}catch(e){if(e.code==='EEXIST')fail('LOCK_BUSY');throw e;}
    try{fs.writeFileSync(fd,JSON.stringify({pid:process.pid,at:new Date().toISOString()}));return callback();}
    finally{fs.closeSync(fd);fs.unlinkSync(lockPath);}
  }
  recoverLocked() {
    const journal=this.load('journal.json',null);
    const current=this.load('state.json',{revision:0,state:this.domain.emptyState()});
    if(!journal)return current;
    if(journal.status==='COMMITTED'){if(hash(journal.after)!==journal.after_hash||current.revision!==journal.after.revision||hash(current)!==journal.after_hash)fail('RECOVERY_CONFLICT');return current;}
    if(journal.status!=='PREPARED'||hash(journal.after)!==journal.after_hash)fail('RECOVERY_CONFLICT');
    if(current.revision===journal.before_revision&&hash(current)===journal.before_hash)this.atomic('state.json',journal.after);
    else if(current.revision!==journal.after.revision||hash(current)!==journal.after_hash)fail('RECOVERY_CONFLICT');
    this.atomic('journal.json',{...journal,status:'COMMITTED'});
    return journal.after;
  }
  recover(){return this.lock(()=>this.recoverLocked());}
  submit(command,context) {
    return this.lock(()=>{
      const before=this.recoverLocked();
      const output=this.domain.execute(before.state,command,context);
      if(output.result.replayed)return output.result;
      const after={revision:before.revision+1,state:output.state};
      const journal={status:'PREPARED',before_revision:before.revision,before_hash:hash(before),after,after_hash:hash(after),receipt:output.result};
      this.atomic('journal.json',journal);this.fault('after_prepare');
      this.atomic('state.json',after);this.fault('after_state');
      this.atomic('journal.json',{...journal,status:'COMMITTED'});this.fault('after_commit');
      return output.result;
    });
  }
  snapshot(){return this.lock(()=>this.recoverLocked());}
}
module.exports={LocalRepository};
