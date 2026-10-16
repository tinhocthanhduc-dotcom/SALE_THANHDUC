/** Đơn bán: chỉ ghi sổ Sales container-bound; Finance chỉ đọc KQ_SALES. */
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
  return values.map((r, i) => ({row: i + 2, data: headers.reduce((o, h, j) => { o[h] = r[j]; return o; }, {})}))
    .filter(x => Object.values(x.data).some(v => v !== '' && v != null));
}
function dbFind_(name, field, value) {
  return dbTable_(name).find(x => dbText_(x.data[field]) === dbText_(value));
}
function dbSetup_() {
  const book = ss_();
  Object.keys(DB_HEADERS_).forEach(name => {
    const sh = book.getSheetByName(name) || book.insertSheet(name), headers = DB_HEADERS_[name];
    dbRoom_(sh, 1, headers.length);
    if (!sh.getLastRow()) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    const actual = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    if (JSON.stringify(actual) !== JSON.stringify(headers)) throw new Error('Sai header sheet ' + name + ', cần kiểm tra trước khi ghi.');
    ['DienThoai', 'MaSoThue', 'MaGiaoDichNH'].forEach(h => {
      const col = headers.indexOf(h);
      if (col >= 0) sh.getRange(1, col + 1, sh.getMaxRows(), 1).setNumberFormat('@');
    });
  });
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
function dbFinance_(fresh) {
  const id = dbText_(PropertiesService.getScriptProperties().getProperty('FINANCE_DB_ID'));
  if (!id) return {connected: false, message: 'Chưa kết nối Finance', rows: []};
  if (id === ss_().getId()) throw new Error('FINANCE_DB_ID phải là file Finance riêng.');
  const cache = CacheService.getScriptCache(), key = 'DON_BAN_FINANCE_' + dbHash_(id);
  if (!fresh) {
    const cached = cache.get(key);
    if (cached) { try { return JSON.parse(cached); } catch (ignore) {} }
  }
  try {
    const sh = SpreadsheetApp.openById(id).getSheetByName('KQ_SALES');
    if (!sh) throw new Error('Thiếu KQ_SALES');
    const values = sh.getDataRange().getValues(), headers = values.shift() || [];
    const needed = 'MA_BAO_THU,MA_DON,KET_QUA,SO_TIEN,ID_GIAO_DICH,MA_PHIEU,LY_DO,NGUOI_XU_LY,XU_LY_LUC'.split(',');
    if (needed.some(h => !headers.includes(h))) throw new Error('Sai header KQ_SALES');
    const seen = new Set();
    const rows = values.filter(r => dbText_(r[headers.indexOf('MA_BAO_THU')])).map(r => {
      const o = {}; needed.forEach(h => { const v = r[headers.indexOf(h)]; o[h] = v instanceof Date ? v.toISOString() : v; });
      if (seen.has(o.MA_BAO_THU) || !['DA_XAC_NHAN', 'TU_CHOI'].includes(o.KET_QUA) ||
          !Number.isSafeInteger(Number(o.SO_TIEN)) || Number(o.SO_TIEN) < 0) throw new Error('Kết quả Finance trùng/không hợp lệ');
      seen.add(o.MA_BAO_THU); return o;
    });
    const result = {connected: true, message: '', rows};
    const encoded = JSON.stringify(result);
    if (Utilities.newBlob(encoded).getBytes().length < 95000) cache.put(key, encoded, 60);
    return result;
  } catch (error) { throw new Error('Không đọc được Finance. Hãy kiểm tra FINANCE_DB_ID, quyền và KQ_SALES rồi bấm Làm mới.'); }
}
function dbPaymentState_(order, receipts, finance) {
  const results = finance.rows.filter(x => x.MA_DON === order.MaDon);
  const byReceipt = Object.fromEntries(results.map(x => [x.MA_BAO_THU, x]));
  receipts.forEach(r => {
    const other = finance.rows.find(x => x.MA_BAO_THU === r.MaBaoThu);
    if (other && (other.MA_DON !== order.MaDon || (other.KET_QUA === 'DA_XAC_NHAN' && Number(other.SO_TIEN) !== Number(r.SoTien))))
      throw new Error('Kết quả Finance không khớp báo thu ' + r.MaBaoThu);
  });
  const confirmed = results.filter(x => x.KET_QUA === 'DA_XAC_NHAN').reduce((n, r) => n + Number(r.SO_TIEN), 0);
  const pending = receipts.filter(x => x.TrangThai === 'CHỜ XÁC NHẬN' && !byReceipt[x.MaBaoThu]).reduce((n, r) => n + Number(r.SoTien), 0);
  const warnings = receipts.filter(x => x.TrangThai === 'ĐÃ HỦY' && byReceipt[x.MaBaoThu]?.KET_QUA === 'DA_XAC_NHAN')
    .map(x => x.MaBaoThu + ': Đã hủy nhưng Finance đã ghi thu, cần kế toán xử lý');
  return {DaThuXacNhan: confirmed, DangCho: pending, ConPhaiThu: Number(order.TongTien) - confirmed,
    MucThanhToan: confirmed >= Number(order.TongTien) ? 'ĐÃ THU ĐỦ' : confirmed > 0 ? 'THU MỘT PHẦN' : 'CHƯA THU', warnings,
    baoThu: receipts.map(r => ({...r, finance: byReceipt[r.MaBaoThu] || null}))};
}
function dbJson_(value) { return JSON.parse(JSON.stringify(value)); }
function dbRead_(fn) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try { dbSetup_(); dbRecover_(); return dbJson_(fn()); } finally { lock.releaseLock(); }
}
function listDonBan(forceRefresh) {
  return dbRead_(() => {
    const finance = dbFinance_(forceRefresh === true), receipts = dbTable_('BAO_THU').map(x => x.data);
    return {finance: {connected: finance.connected, message: finance.message}, employees: dbEmployees_(),
      orders: dbTable_('DON_BAN').map(x => ({...x.data, ...dbPaymentState_(x.data, receipts.filter(r => r.MaDon === x.data.MaDon), finance)}))
        .sort((a, b) => String(b.NgayChot).localeCompare(String(a.NgayChot)))};
  });
}
function getDonBan(maDon, forceRefresh) {
  return dbRead_(() => {
    const found = dbFind_('DON_BAN', 'MaDon', maDon); if (!found) throw new Error('Không tìm thấy đơn bán.');
    const finance = dbFinance_(forceRefresh === true);
    return {order: {...found.data, ...dbPaymentState_(found.data, dbTable_('BAO_THU').map(x => x.data).filter(r => r.MaDon === maDon), finance)},
      items: dbTable_('CHI_TIET_DON_BAN').map(x => x.data).filter(x => x.MaDon === maDon), employees: dbEmployees_(),
      finance: {connected: finance.connected, message: finance.message}};
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
    const fingerprint = dbHash_(JSON.stringify({action, payload})), old = props.getProperty(key);
    if (old) { const receipt = JSON.parse(old); if (receipt.fingerprint !== fingerprint) throw new Error('requestId đã dùng cho nội dung khác.'); return receipt.result; }
    let plan;
    try { plan = prepare(); } catch (error) { throw new Error('DON_BAN_VALIDATION: ' + (error.message || error)); }
    plan.key = key; plan.fingerprint = fingerprint;
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
    ['DienThoai', 'MaSoThue', 'MaGiaoDichNH'].forEach(h => { const c = headers.indexOf(h); if (c >= 0) sh.getRange(row, c + 1).setNumberFormat('@'); });
    if (found) {
      // Chỉ sửa đúng cột của delta: đổi trạng thái không ghi lại giá/VAT/công thức cũ.
      Object.keys(step.data).filter(h => !step.keys.includes(h)).forEach(h => {
        const col = headers.indexOf(h); if (col < 0) throw new Error('Thiếu cột ' + h);
        sh.getRange(row, col + 1).setValue(safe(step.data[h]));
      });
    } else {
      sh.getRange(row, 1, 1, headers.length).setValues([headers.map(h => safe(step.data[h] == null ? '' : step.data[h]))]);
    }
  });
  SpreadsheetApp.flush();
  props.setProperty(plan.key, JSON.stringify({fingerprint: plan.fingerprint, result: plan.result}));
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
    const finance = dbFinance_(true), receipts = dbTable_('BAO_THU').map(x => x.data).filter(r => r.MaDon === id);
    const state = dbPaymentState_(order, receipts, finance);
    if (state.DaThuXacNhan > 0 || state.DangCho > 0) throw new Error('Đơn có báo thu đang chờ hoặc đã xác nhận, không thể hủy.');
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
    if (!dbEmployees_().includes(p.nguoiBao)) throw new Error('Chọn người báo trong NHAN_VIEN_BAN_HANG của CAU_HINH.');
    const order = dbFind_('DON_BAN', 'MaDon', p.maDon)?.data;
    if (!order || order.TrangThaiDon === 'ĐÃ HỦY') throw new Error('Đơn không tồn tại hoặc đã hủy.');
    const state = dbPaymentState_(order, dbTable_('BAO_THU').map(x => x.data).filter(r => r.MaDon === p.maDon), dbFinance_(true));
    if (p.soTien > state.ConPhaiThu - state.DangCho) throw new Error('Số báo thu vượt số còn được báo (đã trừ khoản chờ).');
    const no = nextNo_('BT'), now = new Date().toISOString();
    return {steps: [dbStep_('BAO_THU', ['MaBaoThu'], {MaBaoThu: no, MaDon: order.MaDon, MaKhachHang: order.MaKhachHang,
      TenKhach: order.TenKhach, SoTien: p.soTien, HinhThuc: p.hinhThuc, MaGiaoDichNH: p.hinhThuc === 'TIEN_MAT' ? '' : p.maGiaoDichNH,
      NguoiBao: p.nguoiBao, TrangThai: 'CHỜ XÁC NHẬN', GhiChu: p.ghiChu, LyDoHuy: '', RequestId: input.requestId, TaoLuc: now, CapNhatLuc: now})],
      result: {success: true, maBaoThu: no, maDon: order.MaDon}};
  });
}
function huyBaoThu(maBaoThu, lyDo, requestId) {
  const id = dbText_(maBaoThu), reason = dbText_(lyDo);
  return dbRun_('huyBaoThu', requestId, {maBaoThu: id, lyDo: reason}, () => {
    if (!reason) throw new Error('Bắt buộc nhập lý do hủy.');
    const receipt = dbFind_('BAO_THU', 'MaBaoThu', id)?.data;
    if (!receipt || receipt.TrangThai !== 'CHỜ XÁC NHẬN') throw new Error('Chỉ hủy báo thu đang chờ xác nhận.');
    if (dbFinance_(true).rows.some(r => r.MA_BAO_THU === id)) throw new Error('Finance đã có kết quả, không thể hủy báo thu.');
    return {steps: [dbStep_('BAO_THU', ['MaBaoThu'], {MaBaoThu: id, TrangThai: 'ĐÃ HỦY', LyDoHuy: reason, CapNhatLuc: new Date().toISOString()})], result: {success: true, maBaoThu: id}};
  });
}
