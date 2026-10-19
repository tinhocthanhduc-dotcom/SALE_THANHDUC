const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
test('direct partial and full collection, persistent success, no Finance, retry and overpayment',()=>{
 const f=fixture();f.box.chotDon('BG-TEST','order');f.props.FINANCE_DB_ID='BROKEN';
 const first=f.pay();assert.equal(f.pay().maBaoThu,first.maBaoThu);
 let d=f.box.getDonBan('DB-000001').order;assert.equal(d.DaThuXacNhan,50000);assert.equal(d.DangCho,0);assert.equal(d.ConPhaiThu,79600);
 assert.throws(()=>f.pay(80000,'too-much'),/vượt/);f.pay(79600,'balance');
 d=f.box.listDonBan().orders[0];assert.equal(d.MucThanhToan,'Đã Thu Tiền');assert.equal(d.TrangThaiDon,'Đơn thành công');assert.equal(d.ConPhaiThu,0);
 assert.equal(f.rows('DON_BAN')[0].TrangThaiDon,'Đơn thành công');assert.equal(f.rows('BAO_THU').length,2);assert.equal(f.financeReads(),0);
 assert.throws(()=>f.pay(1,'extra'),/vượt/);assert.throws(()=>f.box.huyDon(d.MaDon,'reason','cancel'),/không thể hủy/);
});
test('historical pending and cancelled reports are not treated as received money',()=>{
 const f=fixture();f.box.chotDon('BG-TEST','order');f.pay();f.update('BAO_THU','MaBaoThu','BT-000001',{TrangThai:'CHỜ XÁC NHẬN'});
 let d=f.box.getDonBan('DB-000001').order;assert.equal(d.DaThuXacNhan,0);assert.equal(d.DangCho,50000);assert.throws(()=>f.pay(129600,'full'),/vượt/);
 f.box.huyBaoThu('BT-000001','Duplicate legacy report','cancel');f.pay(129600,'full-new');assert.equal(f.box.getDonBan('DB-000001').order.TrangThaiDon,'Đơn thành công');
});
