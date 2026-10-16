'use strict';
const vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
class Sheet {
  constructor(book,name,values=[]){this.book=book;this.name=name;this.data=values;this.formats=[];this.maxRows=1000;this.maxCols=Math.max(26,...values.map(r=>r.length));}
  isSheetHidden(){return !!this.hidden;} hideSheet(){this.book.onMutation?.(this.name,'hide');this.hidden=true;return this;} getLastRow(){return this.data.length;} getLastColumn(){return Math.max(0,...this.data.map(r=>r.length));}
  getMaxRows(){return this.maxRows;} getMaxColumns(){return this.maxCols;} insertRowsAfter(n,count){this.book.onMutation?.(this.name,'rows');this.maxRows+=count;}insertColumnsAfter(n,count){this.book.onMutation?.(this.name,'cols');this.maxCols+=count;}
  getDataRange(){return this.getRange(1,1,Math.max(1,this.getLastRow()),Math.max(1,this.getLastColumn()));}
  getRange(row,col,n=1,w=1){const sh=this;const r={getValues:()=>{sh.book.onRead?.(sh.name,row,col,n,w);return Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>sh.data[row-1+i]?.[col-1+j]??''));},
    getValue:()=>sh.data[row-1]?.[col-1],getRow:()=>row,
    setValues:values=>{sh.book.beforeWrite?.(sh.name,row,values);for(let i=0;i<n;i++){sh.data[row-1+i]??=[];for(let j=0;j<w;j++){const v=values[i][j];sh.data[row-1+i][col-1+j]=typeof v==='string'&&v.startsWith("'")?v.slice(1):v;}}sh.book.afterWrite?.(sh.name,row,values);return r;},
    setValue:v=>r.setValues([[v]]),setNumberFormat:f=>{sh.book.onMutation?.(sh.name,'format');sh.formats.push({row,col,n,w,f});return r;},
    createTextFinder:target=>({matchEntireCell(){return this;},findNext(){return this.findAll()[0]||null;},findAll(){return r.getValues().flatMap((v,i)=>String(v[0])===target?[sh.getRange(row+i,col)]:[]);}})};return r;}
  deleteRows(row,count){this.data.splice(row-1,count);}
}
class Book{constructor(id){this.id=id;this.sheets={};}getId(){return this.id;}getSheetByName(n){return this.sheets[n]||null;}insertSheet(n){return this.sheets[n]=new Sheet(this,n);}seed(n,headers,objects){this.sheets[n]=new Sheet(this,n,[headers,...objects.map(o=>headers.map(h=>o[h]??''))]);return this.sheets[n];}}
function fixture(){let held=false,financeReads=0;const metrics={reads:{},writes:{},lockCalls:0};const sales=new Book('TEST_SALES'),finance=new Book('TEST_FINANCE'),props={},cache=new Map();
 const qHeaders='SoBaoGia,NgayBaoGia,MaKhachHang,TenKhachHang,NguoiLienHe,DienThoai,HieuLucDen,TienHang,ChietKhau,VAT,TongThanhToan,TrangThai,NguoiLap,GhiChu,LinkPDF,CheDoVAT'.split(',');
 const lHeaders='SoBaoGia,STT,MaSanPham,TenSanPham,DonViTinh,SoLuong,DonGia,ChietKhauDong,VAT,ThanhTien,GiaDaGomVAT,DaQuaSuDung'.split(',');
 sales.seed('BAO_GIA',qHeaders,[{SoBaoGia:'BG-TEST',NgayBaoGia:'2026-10-16',MaKhachHang:'KH01',TenKhachHang:'Nguyễn An',DienThoai:'0909123456',TienHang:123456,ChietKhau:3456,VAT:9600,TongThanhToan:129600,TrangThai:'NHÁP',GhiChu:'TEST_ giữ giá',CheDoVAT:'ADD_8'}]);
 sales.seed('CHI_TIET_BAO_GIA',lHeaders,[{SoBaoGia:'BG-TEST',STT:1,MaSanPham:'TD01',TenSanPham:'TEST Máy',DonViTinh:'Bộ',SoLuong:2,DonGia:61728,ChietKhauDong:0,VAT:.08,ThanhTien:133332,GiaDaGomVAT:false,DaQuaSuDung:true}]);
 sales.seed('KHACH_HANG',['MaKhachHang','MaSoThue','MaKhachChung'],[{MaKhachHang:'KH01',MaSoThue:'0312345678',MaKhachChung:'KTD-000001'}]);
 sales.seed('CAU_HINH',['Khoa','GiaTri'],[{Khoa:'NHAN_VIEN_BAN_HANG',GiaTri:'An, Bình, An'}]);
 sales.seed('HOP_DONG',['MaBaoGia'],[]);
 const fHeaders='MA_BAO_THU,MA_DON,KET_QUA,SO_TIEN,ID_GIAO_DICH,MA_PHIEU,LY_DO,NGUOI_XU_LY,XU_LY_LUC'.split(',');finance.seed('KQ_SALES',fHeaders,[]);
 const properties={getProperties:()=>({...props}),getProperty:k=>props[k]??null,setProperty:(k,v)=>{props[k]=v;return properties;},deleteProperty:k=>delete props[k]};
 const box={console,Date,JSON,Number,String,Set,Object,Array,Math,Session:{getActiveUser:()=>({getEmail:()=> 'TEST_OWNER'})},
  SpreadsheetApp:{getActiveSpreadsheet:()=>sales,openById:id=>{financeReads++;if(id!==finance.id)throw Error('FINANCE_UNAVAILABLE');return finance;},flush:()=>{}},
  PropertiesService:{getScriptProperties:()=>properties},CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v)})},
  LockService:{getScriptLock:()=>{metrics.lockCalls++;return {waitLock(){if(held)throw Error('NESTED_LOCK');held=true;},releaseLock(){held=false;}};}},
  Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(alg,s)=>[...crypto.createHash('sha256').update(s).digest()],newBlob:s=>({getBytes:()=>Buffer.from(s)}),formatDate:()=> '202610'}};
 vm.createContext(box);const root=path.resolve(__dirname,'../..');vm.runInContext(fs.readFileSync(path.join(root,'code.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'DonBan.js'),'utf8'),box);
 box.ensureAppReady_=()=>{};
 sales.onMutation=(name,kind)=>{if(!held)throw Error('WRITE_WITHOUT_LOCK');metrics.writes[name]=(metrics.writes[name]||0)+1;};
 sales.onRead=name=>{metrics.reads[name]=(metrics.reads[name]||0)+1;};
 sales.beforeWrite=(name)=>sales.onMutation(name,'values');
 finance.beforeWrite=()=>{throw Error('FINANCE_WRITE_FORBIDDEN');};
 function rows(name){return box.dbJson_(box.dbTable_(name).map(x=>x.data));}
 function update(name,key,value,patch){const sh=sales.getSheetByName(name),h=sh.data[0],r=sh.data.find((r,i)=>i&&r[h.indexOf(key)]===value);for(const [k,v] of Object.entries(patch))r[h.indexOf(k)]=v;}
 function result(r){finance.getSheetByName('KQ_SALES').data.push(fHeaders.map(h=>r[h]??''));}
 function pay(amount=50000,id='pay-1'){return box.baoThu({maDon:'DB-000001',soTien:amount,hinhThuc:'TIEN_MAT',nguoiBao:'An',requestId:id});}
 function withLock(fn){const lock=box.LockService.getScriptLock();lock.waitLock();try{return fn();}finally{lock.releaseLock();}}
 function resetMetrics(){metrics.reads={};metrics.writes={};metrics.lockCalls=0;}
 return {box,sales,finance,props,cache,rows,update,result,pay,metrics,withLock,resetMetrics,financeReads:()=>financeReads,held:()=>held};
}
module.exports={fixture};
