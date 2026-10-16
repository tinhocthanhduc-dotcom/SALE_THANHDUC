'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./fixture.cjs');
const bytes=f=>Buffer.byteLength(JSON.stringify(f.props));
function legacy(f,id='legacy-chot',action='chotDon',payload={soBaoGia:'BG-TEST'},result={success:true,maDon:'DB-OLD',soBaoGia:'BG-TEST'}){
 const key='DON_BAN_REQ_'+f.box.dbHash_(id),fingerprint=f.box.dbHash_(JSON.stringify({action,payload}));
 f.props[key]=JSON.stringify({fingerprint,result});return {key,id,result,fingerprint};
}
test('3.000 lệnh giả: receipt nằm trong sheet ẩn, Properties không tăng và retry cũ trả cùng kết quả',()=>{
 const f=fixture();f.box.migrateDonBanReceipts();const initial=bytes(f);
 for(let i=0;i<3000;i++)f.box.dbRun_('TEST_FAKE','test-'+i,{i},()=>({steps:[],result:{success:true,i}}));
 assert.equal(bytes(f),initial);assert.equal(Object.keys(f.props).filter(k=>k.startsWith('DON_BAN_REQ_')).length,0);
 assert.equal(f.rows('LENH_DON_BAN').length,3000);assert.equal(f.sales.getSheetByName('LENH_DON_BAN').isSheetHidden(),true);
 assert.deepEqual(f.box.dbRun_('TEST_FAKE','test-0',{i:0},()=>{throw Error('MUST_NOT_PREPARE_AGAIN');}),{success:true,i:0});
 assert.throws(()=>f.box.dbRun_('TEST_FAKE','test-0',{i:999},()=>({steps:[],result:{}})),/requestId/);
});
test('lần đầu tự chuyển receipt cũ, retry giữ kết quả và không tạo đơn; chạy lại không nhân đôi',()=>{
 const f=fixture(),old=legacy(f);const result=f.box.chotDon('BG-TEST',old.id);
 assert.deepEqual(result,old.result);assert.equal(f.props[old.key],undefined);assert.equal(f.props.DON_BAN_SCHEMA_V1,'DONE');assert.equal(f.rows('DON_BAN').length,0);
 const saved=f.rows('LENH_DON_BAN')[0];assert.equal(saved.RequestKey,old.key);assert.equal(saved.Fingerprint,old.fingerprint);assert.equal(saved.Action,'chotDon');
 const r=f.box.migrateDonBanReceipts();assert.equal(r.migrated,0);assert.equal(f.rows('LENH_DON_BAN').length,1);
 assert.deepEqual(f.box.chotDon('BG-TEST',old.id),old.result);
});
test('migration lỗi sau ghi sheet trước xóa Properties: chạy lại xác minh, không ghi trùng',()=>{
 const f=fixture(),old=legacy(f);let crash=true;
 f.sales.afterWrite=(name,row)=>{if(name==='LENH_DON_BAN'&&row>1&&crash){crash=false;throw Error('TEST_AFTER_COPY');}};
 assert.throws(()=>f.box.migrateDonBanReceipts(),/TEST_AFTER_COPY/);assert(f.props[old.key]);assert.equal(f.props.DON_BAN_SCHEMA_V1,undefined);
 const r=f.box.migrateDonBanReceipts();assert.equal(r.alreadyCopied,1);assert.equal(f.rows('LENH_DON_BAN').length,1);assert.equal(f.props[old.key],undefined);
 assert.deepEqual(f.box.chotDon('BG-TEST',old.id),old.result);
});
test('receipt migration không khớp hoặc JSON hỏng: giữ nguyên khóa cũ, không xóa dữ liệu',()=>{
 const f=fixture();f.box.migrateDonBanReceipts();const old=legacy(f);
 f.withLock(()=>f.box.dbSaveReceipt_(old.key,'DIFFERENT','chotDon',old.result));
 assert.throws(()=>f.box.migrateDonBanReceipts(),/khác receipt/);assert(f.props[old.key]);
 const g=fixture();g.props.DON_BAN_REQ_TEST='{bad';assert.throws(()=>g.box.migrateDonBanReceipts());assert.equal(g.props.DON_BAN_REQ_TEST,'{bad');
});
test('receipt sheet đã ghi, journal chưa xóa: recover/retry chỉ một receipt và một đơn',()=>{
 const f=fixture();let crash=true;
 f.sales.afterWrite=(name,row)=>{if(name==='LENH_DON_BAN'&&row>1&&crash){crash=false;throw Error('TEST_RECEIPT_FLUSH');}};
 assert.throws(()=>f.box.chotDon('BG-TEST','chot'),/TEST_RECEIPT_FLUSH/);assert(f.props.DON_BAN_PENDING);
 f.box.chotDon('BG-TEST','chot');assert.equal(f.rows('LENH_DON_BAN').length,1);assert.equal(f.rows('DON_BAN').length,1);assert.equal(f.props.DON_BAN_PENDING,undefined);
});
for(const api of ['listDonBan','getDonBan'])test(api+' đã setup: 0 ghi Sheets, 0 LockService, mỗi bảng đọc tối đa một lần',()=>{
 const f=fixture();f.box.chotDon('BG-TEST','chot');f.pay();f.resetMetrics();
 if(api==='listDonBan')f.box.listDonBan();else f.box.getDonBan('DB-000001');
 assert.deepEqual(f.metrics.writes,{});assert.equal(f.metrics.lockCalls,0);
 assert.equal(f.metrics.reads.DON_BAN,1);assert.equal(f.metrics.reads.BAO_THU,1);
 assert.equal(f.metrics.reads.CHI_TIET_DON_BAN||0,api==='getDonBan'?1:0);
 assert.equal(f.metrics.reads.LENH_DON_BAN||0,0);
});
test('đọc không đợi người khác giữ ScriptLock khi không có journal',()=>{
 const f=fixture();f.box.chotDon('BG-TEST','chot');
 f.withLock(()=>{f.resetMetrics();assert.equal(f.box.listDonBan().orders.length,1);assert.equal(f.metrics.lockCalls,0);assert.deepEqual(f.metrics.writes,{});});
});
test('đọc có journal dở: lấy lock để recover, lần đọc tiếp theo không lock/ghi',()=>{
 const f=fixture();let crash=true;f.sales.afterWrite=(name,row)=>{if(name==='DON_BAN'&&row>1&&crash){crash=false;throw Error('TEST_PENDING');}};
 assert.throws(()=>f.box.chotDon('BG-TEST','chot'),/TEST_PENDING/);f.resetMetrics();
 const d=f.box.getDonBan('DB-000001');assert.equal(d.order.MaDon,'DB-000001');assert.equal(f.metrics.lockCalls,1);assert.equal(f.props.DON_BAN_PENDING,undefined);
 f.resetMetrics();f.box.getDonBan('DB-000001');assert.equal(f.metrics.lockCalls,0);assert.deepEqual(f.metrics.writes,{});
});
test('setup thiếu sheet/header rỗng khôi phục dưới lock, không định dạng cả cột',()=>{
 const f=fixture();f.box.listDonBan();const first=f.sales.getSheetByName('BAO_THU');assert.equal(first.formats.length,0);
 delete f.sales.sheets.BAO_THU;f.resetMetrics();f.box.listDonBan();assert.equal(f.metrics.lockCalls,1);assert.equal(f.sales.getSheetByName('BAO_THU').formats.length,0);
 f.sales.getSheetByName('BAO_THU').data=[];f.resetMetrics();f.box.listDonBan();assert.equal(f.metrics.lockCalls,1);
 f.resetMetrics();f.box.listDonBan();assert.equal(f.metrics.lockCalls,0);assert.deepEqual(f.metrics.writes,{});
});
test('journal cũ không có action vẫn recover sang receipt sheet rồi retry được',()=>{
 const f=fixture();let crash=true;f.sales.afterWrite=(name,row)=>{if(name==='DON_BAN'&&row>1&&crash){crash=false;throw Error('TEST_OLD_PENDING');}};
 assert.throws(()=>f.box.chotDon('BG-TEST','chot'),/TEST_OLD_PENDING/);
 const m=JSON.parse(f.props.DON_BAN_PENDING);let raw='';for(let i=0;i<m.chunks;i++)raw+=f.props['DON_BAN_PLAN_'+i];
 const plan=JSON.parse(raw);delete plan.action;raw=JSON.stringify(plan);const count=Math.ceil(raw.length/1800);
 for(let i=0;i<count;i++)f.props['DON_BAN_PLAN_'+i]=raw.slice(i*1800,(i+1)*1800);
 f.props.DON_BAN_PENDING=JSON.stringify({chunks:count,hash:f.box.dbHash_(raw),quote:plan.quote});
 const result=f.box.chotDon('BG-TEST','chot');assert.equal(result.maDon,'DB-000001');assert.equal(f.rows('LENH_DON_BAN')[0].Action,'chotDon');assert.equal(f.rows('DON_BAN').length,1);
});
test('header thiếu giữa bảng được bổ sung trong lock, giữ dữ liệu; header đổi tên bị chặn',()=>{
 const f=fixture();f.box.chotDon('BG-TEST','chot');f.pay();const sh=f.sales.getSheetByName('BAO_THU');sh.data[0][4]='';
 f.resetMetrics();assert.equal(f.box.getDonBan('DB-000001').order.DangCho,50000);assert.equal(sh.data[0][4],'SoTien');assert.equal(f.metrics.lockCalls,1);
 f.resetMetrics();f.box.listDonBan();assert.equal(f.metrics.lockCalls,0);assert.deepEqual(f.metrics.writes,{});
 sh.data[0][4]='CUSTOM_AMOUNT';assert.throws(()=>f.box.listDonBan(),/Sai header/);assert.equal(sh.data[0][4],'CUSTOM_AMOUNT');
});
