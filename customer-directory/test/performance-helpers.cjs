'use strict';
const {sheetDriver,fixture,hash}=require('./helpers.cjs'),{SheetsDriver,rowsFor}=require('../sheets.cjs'),C=require('../core.cjs');
function populated(){
 const raw=sheetDriver(),memory=fixture();
 for(let i=0;i<200;i++)memory.create({TEN:'TEST_LOAD_'+i,DIEN_THOAI:'09'+String(10000000+i),DIA_CHI:'TEST_ADDRESS_'+i});
 for(const [name,rows] of Object.entries(rowsFor(memory.driver.state)))raw.sheets[name].rows.push(...rows.map(r=>r.map(v=>String(v))));
 for(const c of Object.values(memory.driver.state.customers))for(const [kind,value] of [['TEN',c.TEN],['MA',c.MA_KHACH],['DIA_CHI',c.DIA_CHI],...c.DIEN_THOAI.map(p=>['SDT',p])])raw.sheets.CHI_MUC.rows.push([hash(c.MA_KHACH+'|'+kind+'|'+value),kind,value,C.fold(value),c.MA_KHACH]);
 raw.sheets.NGUON.rows.push(...Array.from({length:1770},(_,i)=>['SALE:S'+i,'SALE','S'+i,JSON.stringify({key:'SALE:S'+i,app:'SALE',ma_cu:'S'+i})]));
 raw.sheets.DUYET_TRUNG.rows.push(...Array.from({length:824},(_,i)=>['R'+i,'Không',0,'','','','',1,JSON.stringify({id:'R'+i,keys:[],VERSION:1}),'','']));
 raw.sheets.CD_META.rows.find(r=>r[0]==='COUNTER')[1]='200';raw.sheets.CD_META.rows.find(r=>r[0]==='REVISION')[1]='200';raw.properties.values.CD_COUNTER='200';
 return raw;
}
function meter(raw){const stats={reads:0,cells:0,tables:{},writes:[]};for(const sh of Object.values(raw.sheets))for(const method of ['getDataRange','getRange']){
 const original=sh[method].bind(sh);sh[method]=(...args)=>{const range=original(...args),read=range.getDisplayValues?.bind(range),write=range.setValues?.bind(range);
 if(read)range.getDisplayValues=()=>{const values=read();stats.reads++;stats.cells+=values.reduce((n,r)=>n+r.length,0);stats.tables[sh.name]=(stats.tables[sh.name]||0)+1;return values;};
 if(write)range.setValues=values=>{stats.writes.push({table:sh.name,start:args[0],rows:values});return write(values);};return range;};
 }return stats;}
function request(raw){return fixture(new SheetsDriver(raw.options));}
module.exports={populated,meter,request};
