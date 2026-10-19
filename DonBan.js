/** Đơn bán và thu tiền trực tiếp tại Sales. */
const DB_HEADERS_ = {
  DON_BAN: 'MaDon,SoBaoGia,NgayChot,MaKhachHang,TenKhach,DienThoai,MaSoThue,MaKhachChung,TienHang,ChietKhau,VAT,TongTien,CheDoVAT,TrangThaiDon,NguoiChot,GhiChu,LyDoHuy,RequestId,TaoLuc,CapNhatLuc'.split(','),
  CHI_TIET_DON_BAN: 'MaDon,STT,NguonHang,MaHang,TenHang,DVT,SoLuong,DonGia,CKDong,VATDong,ThanhTien,GiaDaGomVAT,DaQuaSuDung'.split(','),
  BAO_THU: 'MaBaoThu,MaDon,MaKhachHang,TenKhach,SoTien,HinhThuc,MaGiaoDichNH,NguoiBao,TrangThai,GhiChu,LyDoHuy,RequestId,TaoLuc,CapNhatLuc'.split(',')
};
function includeDonBan_() { return HtmlService.createHtmlOutputFromFile('DonBan').getContent(); }
function dbText_(v) { return String(v == null ? '' : v).trim(); }
function dbHash_(v) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, v, Utilities.Charset.UTF_8)
    .map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}
function dbRoom_(sh, row, cols) {
  if (row > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), row - sh.getMaxRows());
  if (cols > sh.getMaxColumns()) sh.insertColumnsAfter(sh.getMaxColumns(), cols - sh.getMaxColumns());
}
function dbTable_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Thiếu sheet ' + name);
  const values = sh.getDataRange().getValues(), headers = (values.shift() || []).map(dbText_);
  const expected = DB_HEADERS_[name] || (name === DB_RECEIPT_TABLE_ ? DB_RECEIPT_HEADERS_ : null);
  if (expected && JSON.stringify(headers) !== JSON.stringify(expected)) {
    const error = new Error('Sai header sheet ' + name + ', cần kiểm tra trước khi đọc/ghi.');
    error.donBanMissingHeader = headers.length <= expected.length && headers.every((h, i) => !h || h === expected[i]);
    throw error;
  }
  return values.map((r, i) => ({row: i + 2, data: headers.reduce((o, h, j) => { o[h] = r[j]; return o; }, {})}))
    .filter(x => Object.values(x.data).some(v => v !== '' && v != null));
}
function dbFind_(name, field, value) {
  return dbTable_(name).find(x => dbText_(x.data[field]) === dbText_(value));
}
const DB_RECEIPT_TABLE_ = 'LENH_DON_BAN';
const DB_RECEIPT_HEADERS_ = ['RequestKey', 'Fingerprint', 'Action', 'ResultJson', 'TaoLuc'];
function dbSchemaReady_() {
  if (PropertiesService.getScriptProperties().getProperty('DON_BAN_SCHEMA_V1') !== 'DONE') return false;
  const book = ss_();
  return Object.keys(DB_HEADERS_).concat(DB_RECEIPT_TABLE_).every(name => {
    const sh = book.getSheetByName(name), headers = DB_HEADERS_[name] || DB_RECEIPT_HEADERS_;
    return sh && sh.getLastRow() > 0 && sh.getLastColumn() >= headers.length;
  });
}
/** Gọi trong ScriptLock, chỉ setup/migrate một lần hoặc khi thiếu bảng/header. */
function dbSetup_(forceMigration) {
  if (!forceMigration && dbSchemaReady_()) return {migrated: 0, alreadyCopied: 0};
  const book = ss_();
  Object.keys(DB_HEADERS_).concat(DB_RECEIPT_TABLE_).forEach(name => {
    const sh = book.getSheetByName(name) || book.insertSheet(name);
    const headers = name === DB_RECEIPT_TABLE_ ? DB_RECEIPT_HEADERS_ : DB_HEADERS_[name];
    dbRoom_(sh, 1, headers.length);
    if (!sh.getLastRow()) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    const actual = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    if (JSON.stringify(actual) !== JSON.stringify(headers)) {
      if (actual.length <= headers.length && actual.every((h, i) => h === '' || h === headers[i]))
        sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      else throw new Error('Sai header sheet ' + name + ', cần kiểm tra trước khi ghi.');
    }
    if (name === DB_RECEIPT_TABLE_ && !sh.isSheetHidden()) sh.hideSheet();
  });
  const result = dbMigrateReceipts_();
  PropertiesService.getScriptProperties().setProperty('DON_BAN_SCHEMA_V1', 'DONE');
  return result;
}
function dbReceipt_(key) {
  const sh = ss_().getSheetByName(DB_RECEIPT_TABLE_), last = sh.getLastRow();
  if (last < 2) return null;
  const matches = sh.getRange(2, 1, last - 1, 1).createTextFinder(key).matchEntireCell(true).findAll();
  if (matches.length > 1) throw new Error('Receipt Đơn bán trùng khóa, báo quản trị.');
  if (!matches.length) return null;
  const row = sh.getRange(matches[0].getRow(), 1, 1, 5).getValues()[0];
  return {fingerprint: row[1], action: row[2], result: JSON.parse(row[3])};
}
function dbSaveReceipt_(key, fingerprint, action, result) {
  const old = dbReceipt_(key);
  if (old) {
    if (old.fingerprint !== fingerprint || JSON.stringify(old.result) !== JSON.stringify(result))
      throw new Error('Receipt Đơn bán không khớp journal, báo quản trị.');
    return;
  }
  const sh = ss_().getSheetByName(DB_RECEIPT_TABLE_), row = sh.getLastRow() + 1;
  dbRoom_(sh, row, 5);
  sh.getRange(row, 1, 1, 5).setValues([[key, fingerprint, action, JSON.stringify(result), new Date().toISOString()]]);
  SpreadsheetApp.flush(); // Receipt phải bền vững trước khi xóa journal tạm.
}
function dbLegacyAction_(result) {
  if (result && result.soBaoGia) return 'chotDon';
  if (result && result.maBaoThu) return result.maDon ? 'baoThu' : 'huyBaoThu';
  return result && result.maDon ? 'huyDon' : 'LEGACY';
}
/** Copy -> flush -> kiểm lại -> xóa từng khóa cũ. Dừng giữa chừng chạy lại an toàn. */
function dbMigrateReceipts_() {
  const props = PropertiesService.getScriptProperties(), all = props.getProperties();
  const keys = Object.keys(all).filter(k => k.startsWith('DON_BAN_REQ_'));
  if (!keys.length) return {migrated: 0, alreadyCopied: 0};
  const sh = ss_().getSheetByName(DB_RECEIPT_TABLE_);
  const copied = new Map();
  dbTable_(DB_RECEIPT_TABLE_).forEach(x => {
    if (copied.has(x.data.RequestKey)) throw new Error('Receipt Đơn bán trùng khóa, báo quản trị.');
    copied.set(x.data.RequestKey, x.data);
  });
  let migrated = 0, alreadyCopied = 0;
  for (let start = 0; start < keys.length; start += 100) {
    const group = keys.slice(start, start + 100), rows = [];
    group.forEach(key => {
      const old = JSON.parse(all[key]);
      if (!old || typeof old.fingerprint !== 'string' || !Object.prototype.hasOwnProperty.call(old, 'result'))
        throw new Error('Receipt cũ không hợp lệ, giữ khóa để quản trị kiểm tra.');
      const saved = copied.get(key), resultJson = JSON.stringify(old.result);
      if (saved) {
        if (saved.Fingerprint !== old.fingerprint || JSON.stringify(JSON.parse(saved.ResultJson)) !== resultJson)
          throw new Error('Receipt cũ khác receipt trong sheet, không xóa khóa cũ.');
        alreadyCopied++;
      } else {
        rows.push([key, old.fingerprint, old.action || dbLegacyAction_(old.result), resultJson, new Date().toISOString()]);
      }
    });
    if (rows.length) {
      const first = sh.getLastRow() + 1;
      dbRoom_(sh, first + rows.length - 1, 5);
      sh.getRange(first, 1, rows.length, 5).setValues(rows);
      SpreadsheetApp.flush();
      if (JSON.stringify(sh.getRange(first, 1, rows.length, 5).getValues()) !== JSON.stringify(rows))
        throw new Error('Chưa xác minh được receipt đã chuyển, giữ khóa cũ.');
      rows.forEach(r => copied.set(r[0], Object.fromEntries(DB_RECEIPT_HEADERS_.map((h, i) => [h, r[i]]))));
      migrated += rows.length;
    }
    group.forEach(key => props.deleteProperty(key));
  }
  return {migrated, alreadyCopied};
}
/** Chủ có thể chạy trực tiếp; tự chạy khi dùng module lần đầu sau nâng cấp. */
function migrateDonBanReceipts() {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const result = dbSetup_(true); dbRecover_();
    const report = {success: true, ...result};
    console.log('don-ban-receipts-migration ' + JSON.stringify(report));
    return report;
  }
  finally { lock.releaseLock(); }
}
/** Chỉ gọi từ nextNo_ khi command Đơn bán đã giữ ScriptLock. Không đổi số BG/HD. */
function donBanNextNo_(prefix) {
  const props = PropertiesService.getScriptProperties(), key = 'DON_BAN_COUNTER_' + prefix;
  const table = prefix === 'DB' ? 'DON_BAN' : 'BAO_THU', field = prefix === 'DB' ? 'MaDon' : 'MaBaoThu';
  const max = dbTable_(table).reduce((n, x) => {
    const m = dbText_(x.data[field]).match(new RegExp('^' + prefix + '-(\\d+)$'));
    return m ? Math.max(n, Number(m[1])) : n;
  }, Number(props.getProperty(key) || 0));
  props.setProperty(key, String(max + 1));
  return prefix + '-' + String(max + 1).padStart(6, '0');
}
/** Chỉ thêm cột nguồn; không chỉnh giá/VAT hoặc suy đoán báo giá cũ. */
function donBanSaveSources_(sh, firstRow, items) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  let col = headers.indexOf('NguonHang') + 1;
  if (!col) {
    col = headers.length + 1;
    dbRoom_(sh, 1, col);
    sh.getRange(1, col).setValue('NguonHang');
  }
  dbRoom_(sh, firstRow + items.length - 1, col);
  sh.getRange(firstRow, col, items.length, 1).setValues(items.map(item => [
    ['SALE', 'KHO'].includes(dbText_(item.source).toUpperCase()) ? dbText_(item.source).toUpperCase() : ''
  ]));
}
function donBanAssertQuoteEditable_(no) {
  const quote = dbFind_(APP.SHEETS.QUOTES, 'SoBaoGia', no);
  const sh = ss_().getSheetByName('DON_BAN');
  const linked = sh && dbTable_('DON_BAN').some(x => dbText_(x.data.SoBaoGia) === no && x.data.TrangThaiDon !== 'ĐÃ HỦY');
  const props = PropertiesService.getScriptProperties();
  const pending = props.getProperty('DON_BAN_PENDING');
  if ((quote && quote.data.TrangThai === 'ĐÃ CHỐT ĐƠN') || linked ||
      (pending && JSON.parse(pending).quote === no)) throw new Error('Báo giá đã chốt đơn, không được sửa hoặc hủy/xóa.');
}
function dbEmployees_() {
  return [...new Set(dbText_(cfg_().NHAN_VIEN_BAN_HANG).split(',').map(dbText_).filter(Boolean))];
}
// Sales records collections locally. Historical pending reports remain reserved until cancelled.
function dbPaymentState_(order, receipts) {
  const confirmed = receipts.filter(r => r.TrangThai === 'Đã Thu Tiền').reduce((n,r) => n + Number(r.SoTien), 0);
  const pending = receipts.filter(r => r.TrangThai === 'CHỜ XÁC NHẬN').reduce((n,r) => n + Number(r.SoTien), 0);
  const remaining = Number(order.TongTien) - confirmed;
  return {DaThuXacNhan: confirmed, DangCho: pending, ConPhaiThu: remaining,
    TrangThaiDon: order.TrangThaiDon === 'ĐÃ HỦY' ? 'ĐÃ HỦY' : remaining <= 0 ? 'Đơn thành công' : 'ĐÃ CHỐT',
    MucThanhToan: remaining <= 0 ? 'Đã Thu Tiền' : confirmed > 0 ? 'THU MỘT PHẦN' : 'CHƯA THU',
    warnings: pending ? ['Có báo thu cũ chưa ghi nhận. Kiểm tra và hủy báo thu cũ trước khi thu lại để tránh ghi trùng.'] : [],
    baoThu: receipts};
}
function dbJson_(value) { return JSON.parse(JSON.stringify(value)); }
function dbRead_(fn) {
  const props = PropertiesService.getScriptProperties();
  if (!dbSchemaReady_() || props.getProperty('DON_BAN_PENDING')) {
    const lock = LockService.getScriptLock(); lock.waitLock(30000);
    try { dbSetup_(); dbRecover_(); } finally { lock.releaseLock(); }
  }
  try { return dbJson_(fn()); } catch (error) {
    if (!error.donBanMissingHeader) throw error;
    const lock = LockService.getScriptLock(); lock.waitLock(30000);
    try { dbSetup_(true); dbRecover_(); } finally { lock.releaseLock(); }
    return dbJson_(fn());
  }
}
function listDonBan(forceRefresh) {
  return dbRead_(() => {
    const receipts = dbTable_('BAO_THU').map(x => x.data);
    return {employees: dbEmployees_(),
      orders: dbTable_('DON_BAN').map(x => ({...x.data, ...dbPaymentState_(x.data, receipts.filter(r => r.MaDon === x.data.MaDon))}))
        .sort((a, b) => String(b.NgayChot).localeCompare(String(a.NgayChot)))};
  });
}
function getDonBan(maDon, forceRefresh) {
  return dbRead_(() => {
    const found = dbFind_('DON_BAN', 'MaDon', maDon); if (!found) throw new Error('Không tìm thấy đơn bán.');
    return {order: {...found.data, ...dbPaymentState_(found.data, dbTable_('BAO_THU').map(x => x.data).filter(r => r.MaDon === maDon))},
      items: dbTable_('CHI_TIET_DON_BAN').map(x => x.data).filter(x => x.MaDon === maDon), employees: dbEmployees_()};
  });
}
/** Một journal delta bền vững trong Script Properties; hoàn tất trước lệnh tiếp theo.
 * Receipt requestId được giữ, không dùng Cache làm cơ chế chống trùng.
 */
function dbRun_(action, requestId, payload, prepare) {
  requestId = dbText_(requestId);
  if (!requestId || requestId.length > 100) throw new Error('Thiếu hoặc sai requestId.');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    dbSetup_(); dbRecover_();
    const props = PropertiesService.getScriptProperties(), key = 'DON_BAN_REQ_' + dbHash_(requestId);
    const fingerprint = dbHash_(JSON.stringify({action, payload})), receipt = dbReceipt_(key);
    if (receipt) { if (receipt.fingerprint !== fingerprint) throw new Error('requestId đã dùng cho nội dung khác.'); return receipt.result; }
    let plan;
    try { plan = prepare(); } catch (error) { throw new Error('DON_BAN_VALIDATION: ' + (error.message || error)); }
    plan.key = key; plan.fingerprint = fingerprint; plan.action = action;
    const raw = JSON.stringify(plan), chunks = Math.ceil(raw.length / 1800);
    if (chunks > 100) throw new Error('Đơn quá lớn, cần chia báo giá trước khi chốt.');
    for (let i = 0; i < chunks; i++) props.setProperty('DON_BAN_PLAN_' + i, raw.slice(i * 1800, (i + 1) * 1800));
    props.setProperty('DON_BAN_PENDING', JSON.stringify({chunks, hash: dbHash_(raw), quote: plan.quote || ''}));
    dbRecover_(); return plan.result;
  } finally { lock.releaseLock(); }
}
function dbRecover_() {
  const props = PropertiesService.getScriptProperties(), manifest = props.getProperty('DON_BAN_PENDING');
  if (!manifest) return;
  const m = JSON.parse(manifest); let raw = '';
  for (let i = 0; i < m.chunks; i++) { const chunk = props.getProperty('DON_BAN_PLAN_' + i); if (chunk == null) throw new Error('Journal Đơn bán thiếu dữ liệu, báo quản trị.'); raw += chunk; }
  if (dbHash_(raw) !== m.hash) throw new Error('Journal Đơn bán sai checksum, báo quản trị.');
  const plan = JSON.parse(raw);
  plan.steps.forEach(step => {
    const sh = ss_().getSheetByName(step.table), headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const found = dbTable_(step.table).find(x => step.keys.every(k => dbText_(x.data[k]) === dbText_(step.data[k])));
    const row = found ? found.row : sh.getLastRow() + 1;
    dbRoom_(sh, row, headers.length);
    const safe = v => typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v;
    if (found) {
      // Chỉ sửa đúng cột của delta: đổi trạng thái không ghi lại giá/VAT/công thức cũ.
      Object.keys(step.data).filter(h => !step.keys.includes(h)).forEach(h => {
        const col = headers.indexOf(h); if (col < 0) throw new Error('Thiếu cột ' + h);
        sh.getRange(row, col + 1).setValue(safe(step.data[h]));
      });
    } else {
      ['DienThoai', 'MaSoThue', 'MaGiaoDichNH'].forEach(h => { const c = headers.indexOf(h); if (c >= 0) sh.getRange(row, c + 1).setNumberFormat('@'); });
      sh.getRange(row, 1, 1, headers.length).setValues([headers.map(h => safe(step.data[h] == null ? '' : step.data[h]))]);
    }
  });
  SpreadsheetApp.flush();
  dbSaveReceipt_(plan.key, plan.fingerprint, plan.action || dbLegacyAction_(plan.result), plan.result);
  props.deleteProperty('DON_BAN_PENDING');
  for (let i = 0; i < m.chunks; i++) props.deleteProperty('DON_BAN_PLAN_' + i);
}
function dbStep_(table, keys, data) { return {table, keys, data}; }
function chotDon(soBaoGia, requestId) {
  const no = dbText_(soBaoGia);
  return dbRun_('chotDon', requestId, {soBaoGia: no}, () => {
    const found = dbFind_(APP.SHEETS.QUOTES, 'SoBaoGia', no);
    if (!found) throw new Error('Không tìm thấy báo giá.');
    const q = found.data;
    if (['HỦY', 'ĐÃ HỦY', 'ĐÃ CHỐT ĐƠN'].includes(dbText_(q.TrangThai).toUpperCase())) throw new Error('Báo giá đã hủy hoặc đã chốt đơn.');
    if (dbTable_('DON_BAN').some(x => x.data.SoBaoGia === no && x.data.TrangThaiDon !== 'ĐÃ HỦY')) throw new Error('Báo giá đã có đơn bán.');
    const lines = dbTable_(APP.SHEETS.QUOTE_LINES).map(x => x.data).filter(x => x.SoBaoGia === no);
    if (!lines.length || !Number.isFinite(Number(q.TongThanhToan))) throw new Error('Báo giá thiếu dòng hàng hoặc tổng tiền.');
    const customer = dbFind_(APP.SHEETS.CUSTOMERS, 'MaKhachHang', q.MaKhachHang)?.data || {};
    const now = new Date().toISOString(), maDon = nextNo_('DB');
    const order = {MaDon: maDon, SoBaoGia: no, NgayChot: now, MaKhachHang: q.MaKhachHang, TenKhach: q.TenKhachHang,
      DienThoai: dbText_(q.DienThoai), MaSoThue: dbText_(q.MaSoThue || customer.MaSoThue),
      MaKhachChung: '', // Bước 1 chưa nối Danh bạ KTD.
      TienHang: q.TienHang, ChietKhau: q.ChietKhau, VAT: q.VAT, TongTien: q.TongThanhToan, CheDoVAT: q.CheDoVAT,
      TrangThaiDon: 'ĐÃ CHỐT', NguoiChot: Session.getActiveUser().getEmail() || 'Người dùng', GhiChu: q.GhiChu,
      LyDoHuy: '', RequestId: requestId, TaoLuc: now, CapNhatLuc: now};
    const steps = lines.map((l, i) => dbStep_('CHI_TIET_DON_BAN', ['MaDon', 'STT'], {MaDon: maDon, STT: i + 1,
      NguonHang: l.NguonHang || '', MaHang: l.MaSanPham, TenHang: l.TenSanPham, DVT: l.DonViTinh,
      SoLuong: l.SoLuong, DonGia: l.DonGia, CKDong: l.ChietKhauDong, VATDong: l.VAT, ThanhTien: l.ThanhTien,
      GiaDaGomVAT: l.GiaDaGomVAT, DaQuaSuDung: l.DaQuaSuDung}));
    steps.push(dbStep_('DON_BAN', ['MaDon'], order), dbStep_(APP.SHEETS.QUOTES, ['SoBaoGia'], {SoBaoGia: no, TrangThai: 'ĐÃ CHỐT ĐƠN'}));
    return {quote: no, steps, result: {success: true, maDon, soBaoGia: no}};
  });
}
function huyDon(maDon, lyDo, requestId) {
  const id = dbText_(maDon), reason = dbText_(lyDo);
  return dbRun_('huyDon', requestId, {maDon: id, lyDo: reason}, () => {
    if (!reason) throw new Error('Bắt buộc nhập lý do hủy.');
    const order = dbFind_('DON_BAN', 'MaDon', id)?.data;
    if (!order || order.TrangThaiDon === 'ĐÃ HỦY') throw new Error('Đơn không tồn tại hoặc đã hủy.');
    const receipts = dbTable_('BAO_THU').map(x => x.data).filter(r => r.MaDon === id);
    const state = dbPaymentState_(order, receipts);
    if (state.DaThuXacNhan > 0 || state.DangCho > 0) throw new Error('Đơn đã thu tiền hoặc có báo thu cũ đang chờ, không thể hủy.');
    const now = new Date().toISOString();
    return {steps: [dbStep_('DON_BAN', ['MaDon'], {MaDon: id, TrangThaiDon: 'ĐÃ HỦY', LyDoHuy: reason, CapNhatLuc: now}),
      dbStep_(APP.SHEETS.QUOTES, ['SoBaoGia'], {SoBaoGia: order.SoBaoGia, TrangThai: 'ĐÃ CẬP NHẬT'})], result: {success: true, maDon: id}};
  });
}
function baoThu(input) {
  input = input || {};
  const p = {maDon: dbText_(input.maDon), soTien: input.soTien, hinhThuc: dbText_(input.hinhThuc),
    maGiaoDichNH: dbText_(input.maGiaoDichNH), nguoiBao: dbText_(input.nguoiBao), ghiChu: dbText_(input.ghiChu)};
  return dbRun_('baoThu', input.requestId, p, () => {
    if (typeof p.soTien !== 'number' || !Number.isSafeInteger(p.soTien) || p.soTien <= 0) throw new Error('Số tiền phải là số nguyên lớn hơn 0.');
    if (!['TIEN_MAT', 'CK_ACB', 'CK_TCB'].includes(p.hinhThuc)) throw new Error('Hình thức không hợp lệ.');
    if (!dbEmployees_().includes(p.nguoiBao)) throw new Error('Chọn người thu trong NHAN_VIEN_BAN_HANG của CAU_HINH.');
    const order = dbFind_('DON_BAN', 'MaDon', p.maDon)?.data;
    if (!order || order.TrangThaiDon === 'ĐÃ HỦY') throw new Error('Đơn không tồn tại hoặc đã hủy.');
    const state = dbPaymentState_(order, dbTable_('BAO_THU').map(x => x.data).filter(r => r.MaDon === p.maDon));
    if (p.soTien > state.ConPhaiThu - state.DangCho) throw new Error('Số thu tiền vượt số còn được thu (đã trừ báo thu cũ đang chờ).');
    const no = nextNo_('BT'), now = new Date().toISOString();
    return {steps: [dbStep_('BAO_THU', ['MaBaoThu'], {MaBaoThu: no, MaDon: order.MaDon, MaKhachHang: order.MaKhachHang,
      TenKhach: order.TenKhach, SoTien: p.soTien, HinhThuc: p.hinhThuc, MaGiaoDichNH: p.hinhThuc === 'TIEN_MAT' ? '' : p.maGiaoDichNH,
      NguoiBao: p.nguoiBao, TrangThai: 'Đã Thu Tiền', GhiChu: p.ghiChu, LyDoHuy: '', RequestId: input.requestId, TaoLuc: now, CapNhatLuc: now}),
      dbStep_('DON_BAN', ['MaDon'], {MaDon: order.MaDon, TrangThaiDon: state.ConPhaiThu === p.soTien ? 'Đơn thành công' : 'ĐÃ CHỐT', CapNhatLuc: now})],
      result: {success: true, maBaoThu: no, maDon: order.MaDon}};
  });
}
function huyBaoThu(maBaoThu, lyDo, requestId) {
  const id = dbText_(maBaoThu), reason = dbText_(lyDo);
  return dbRun_('huyBaoThu', requestId, {maBaoThu: id, lyDo: reason}, () => {
    if (!reason) throw new Error('Bắt buộc nhập lý do hủy.');
    const receipt = dbFind_('BAO_THU', 'MaBaoThu', id)?.data;
    if (!receipt || receipt.TrangThai !== 'CHỜ XÁC NHẬN') throw new Error('Chỉ hủy báo thu đang chờ xác nhận.');
    return {steps: [dbStep_('BAO_THU', ['MaBaoThu'], {MaBaoThu: id, TrangThai: 'ĐÃ HỦY', LyDoHuy: reason, CapNhatLuc: new Date().toISOString()})], result: {success: true, maBaoThu: id}};
  });
}

// Keep the historical RPC for compatibility and request replay.
function thuTien(input) { return baoThu(input); }
