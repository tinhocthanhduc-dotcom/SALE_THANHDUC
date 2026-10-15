"use strict";
const C = require("./core.cjs");
const SOURCE_TABLES = { SALE: "KHACH_HANG", CARE: "Khách hàng", FIN: "KHACH_HANG" };
function flag(v) {
  if (v === true || v === 1 || ["true", "1", "co", "yes"].includes(C.fold(v))) return true;
  if (v === false || v === 0 || v === "" || v == null || ["false", "0", "khong", "no"].includes(C.fold(v))) return false;
  C.fail("SOURCE_BOOLEAN_INVALID");
}
function objects(headers, rows, required) {
  if (new Set(headers).size !== headers.length || required.some((k) => !headers.includes(k))) C.fail("SOURCE_SCHEMA_MISMATCH");
  return rows.filter((r) => r.some((v) => v !== "" && v !== null)).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}
function date(v) {
  return v instanceof Date && !isNaN(v) ? v.toISOString() : typeof v === "string" && /^\d{4}-\d{2}-\d{2}(T|$)/.test(v) && !isNaN(Date.parse(v)) ? new Date(v).toISOString() : null;
}
function amount(v) {
  if (v === "" || v == null) return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) C.fail("SOURCE_AMOUNT_INVALID");
  return n;
}
function fromTables(app, tables) {
  const source = tables[SOURCE_TABLES[app]];
  if (!source) C.fail("SOURCE_SHEET_MISSING");
  let rows = [];
  if (app === "SALE") {
    rows = objects(source.headers, source.rows, ["MaKhachHang", "TenKhachHang", "DienThoai", "MaSoThue"]).map((r) => ({ app, ma_cu: r.MaKhachHang, TEN: r.TenKhachHang, MST: r.MaSoThue, DIEN_THOAI: r.DienThoai, DIA_CHI: r.DiaChi, EMAIL: r.Email, LOAI: r.MaSoThue || /cong ty|doanh nghiep/.test(C.fold(r.LoaiKhach)) ? "CONG_TY" : "CA_NHAN", NGUOI_LIEN_HE: r.NguoiDaiDien ? [{ ten: String(r.NguoiDaiDien), dien_thoai: [], ghi_chu: String(r.ChucVu || "") }] : [], updated_at: date(r.CapNhatLuc || r.NgayCapNhat) }));
  } else if (app === "CARE") {
    rows = objects(source.headers, source.rows, ["Mã khách hàng", "Tên khách hàng", "Số điện thoại", "Địa chỉ"]).map((r) => ({ app, ma_cu: r["Mã khách hàng"], TEN: r["Công ty"] || r["Tên khách hàng"], DIEN_THOAI: r["Số điện thoại"], DIA_CHI: r["Địa chỉ"], LOAI: r["Công ty"] ? "CONG_TY" : "CA_NHAN", NGUOI_LIEN_HE: r["Công ty"] && r["Tên khách hàng"] ? [{ ten: String(r["Tên khách hàng"]), dien_thoai: C.phones(r["Số điện thoại"]), ghi_chu: "" }] : [], updated_at: date(r["Cập nhật lúc"]) }));
  } else if (app === "FIN") {
    const debt = tables.CONG_NO_KH;
    if (!debt) C.fail("DEBT_SOURCE_REQUIRED");
    const debts = objects(debt.headers, debt.rows, ["ID_KH", "CON_LAI", "TRANG_THAI"]);
    const open = new Set(debts.filter((r) => amount(r.CON_LAI) > 0 && !["DA_HUY", "DA_XOA"].includes(String(r.TRANG_THAI))).map((r) => String(r.ID_KH)));
    rows = objects(source.headers, source.rows, ["ID_KH", "TEN_KH", "DIEN_THOAI", "MA_SO_THUE", "LA_KHACH_HANG", "HAN_MUC_NO"]).filter((r) => flag(r.LA_KHACH_HANG)).map((r) => ({ app, ma_cu: r.ID_KH, aliases: r.MA_KH && r.MA_KH !== r.ID_KH ? [String(r.MA_KH)] : [], TEN: r.TEN_KH, MST: r.MA_SO_THUE, DIEN_THOAI: r.DIEN_THOAI, DIA_CHI: r.DIA_CHI, EMAIL: r.EMAIL, HAN_MUC_NO: amount(r.HAN_MUC_NO), CHO_PHEP_NO: amount(r.HAN_MUC_NO) > 0, open_debt: open.has(String(r.ID_KH)), updated_at: date(r.CAP_NHAT_LUC) }));
  } else C.fail("UNKNOWN_SOURCE");
  return rows;
}
function decodeSnapshot(rows, hash, kinds) {
  const manifests = rows.filter((r) => kinds.includes(r[1]));
  let latest = null;
  for (const m of manifests) {
    const parts = rows.filter((r) => r[0] === m[0] && r[1] === "DATA").sort((a, b) => Number(a[2]) - Number(b[2]));
    if (parts.length !== Number(m[3]) || parts.some((r, i) => Number(r[2]) !== i || r[4] !== m[4])) C.fail("DISPATCH_SNAPSHOT_CORRUPT");
    const raw = parts.map((r) => r[5]).join("");
    if (hash(raw) !== m[4]) C.fail("DISPATCH_SNAPSHOT_CORRUPT");
    const v = JSON.parse(raw);
    if (!Number.isSafeInteger(v.revision) || v.revision < 1) C.fail("DISPATCH_SNAPSHOT_CORRUPT");
    if (!latest || v.revision > latest.revision) latest = v;
  }
  return latest;
}
function fromDispatch(state) {
  if (!state || !state.customers || !state.orders) C.fail("DISPATCH_SNAPSHOT_REQUIRED");
  const approved = Object.values(state.debts || {}).filter((d) => d.status === "approved"), paid = {};
  for (const p of Object.values(state.payments || {})) {
    if (["replaced", "rejected", "awaiting_correction"].includes(p.status)) continue;
    const allocations = p.debt_allocations || [], unallocated = p.amount - allocations.reduce((n, a) => n + a.amount, 0);
    let confirmed = p.confirmations ? p.confirmations.reduce((n, c) => n + c.amount, 0) : p.status === "confirmed" ? p.amount : p.kind === "cash" ? p.deposited_amount || 0 : 0;
    confirmed = Math.max(0, confirmed - unallocated);
    for (const a of allocations) {
      const n = Math.min(confirmed, a.amount);
      paid[a.debt_id] = (paid[a.debt_id] || 0) + n;
      confirmed -= n;
    }
  }
  const open = new Set(approved.filter((d) => d.amount > (paid[d.id] || 0)).map((d) => d.customer_id));
  for (const o of Object.values(state.orders)) {
    if (o.credit_remaining_at_close > 0) open.add(o.customer_id);
    const j = state.integration?.outbox?.["DIEUPHOI:CN:" + o.order_no];
    if (j?.kind === "CONG_NO_KH" && !j.debt_id && j.amount > 0) open.add(o.customer_id);
  }
  return Object.values(state.customers).map((c) => ({ app: "DISPATCH", ma_cu: c.id, aliases: c.customer_no ? [c.customer_no] : [], TEN: c.name, DIEN_THOAI: c.phone, DIA_CHI: c.address, EMAIL: c.email, CHO_PHEP_NO: c.allow_credit === void 0 ? c.terms === "credit" : c.allow_credit === true, terms: c.terms, open_debt: open.has(c.id), updated_at: date(c.updated_at || c.created_at) }));
}
module.exports = { SOURCE_TABLES, fromTables, fromDispatch, decodeSnapshot, flag, date };
