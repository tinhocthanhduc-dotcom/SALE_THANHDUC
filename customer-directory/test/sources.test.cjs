"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), S = require("../sources.cjs"), { hash } = require("./helpers.cjs"), M = require("../migration.cjs");
test("source adapters use actual Sales/CARE headers, retain contact and ISO dates", () => {
  const sale = S.fromTables("SALE", { KHACH_HANG: { headers: ["MaKhachHang", "TenKhachHang", "DienThoai", "MaSoThue", "DiaChi", "NguoiDaiDien"], rows: [["S1", "Công ty mẫu", "0901234567", "0101234567", "Địa chỉ", "Đại diện"]] } });
  assert.equal(sale[0].ma_cu, "S1");
  assert.equal(sale[0].NGUOI_LIEN_HE[0].ten, "Đại diện");
  const care = S.fromTables("CARE", { "Khách hàng": { headers: ["Mã khách hàng", "Tên khách hàng", "Số điện thoại", "Địa chỉ", "Công ty", "Cập nhật lúc"], rows: [["C1", "Liên hệ", "0901234567", "Mới", "Công ty mẫu", /* @__PURE__ */ new Date("2026-10-14")]] } });
  assert.equal(care[0].TEN, "Công ty mẫu");
  assert.equal(care[0].NGUOI_LIEN_HE[0].ten, "Liên hệ");
  assert.equal(care[0].updated_at, "2026-10-14T00:00:00.000Z");
});
test("Finance filters NCC and only explicit LA_KHACH_HANG; open debt matches ID_KH", () => {
  const rows = S.fromTables("FIN", { KHACH_HANG: { headers: ["ID_KH", "TEN_KH", "DIEN_THOAI", "MA_SO_THUE", "LA_KHACH_HANG", "HAN_MUC_NO"], rows: [["K1", "Khách", "0901234567", "", true, 2e5], ["NCC1", "NCC", "0912345678", "", false, 0], ["BOTH", "Vừa KH/NCC", "0923456789", "", true, 0], ["BLANK", "Không cờ", "", "", "", 0]] }, CONG_NO_KH: { headers: ["ID_KH", "CON_LAI", "TRANG_THAI"], rows: [["K1", 1e5, "CHUA_THU"], ["BOTH", 0, "DA_THU"]] } });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].open_debt, true);
  assert.equal(rows[1].open_debt, false);
  assert.throws(() => S.fromTables("FIN", { KHACH_HANG: { headers: [], rows: [] } }), /DEBT_SOURCE_REQUIRED/);
});
test("Dispatch copied state credit permission fallback and repaid CN balances, no original app calls", () => {
  const rows = S.fromDispatch({ customers: { c: { id: "c", name: "Khách", phone: "0901234567", terms: "credit" }, d: { id: "d", name: "Khác", phone: "0912345678", terms: "credit", allow_credit: false } }, orders: {}, debts: { n: { id: "n", customer_id: "c", status: "approved", amount: 100 } }, payments: { p: { id: "p", status: "confirmed", amount: 100, debt_allocations: [{ debt_id: "n", amount: 100 }] } } });
  assert.equal(rows[0].CHO_PHEP_NO, true);
  assert.equal(rows[0].open_debt, false);
  assert.equal(rows[1].CHO_PHEP_NO, false);
});
test("copied Dispatch snapshot hash/order verified and schema corruption rejected", () => {
  const value = { revision: 3, state: { customers: {}, orders: {} } }, raw = JSON.stringify(value), rows = [["a", "DATA", 0, 1, hash(raw), raw], ["a", "SNAPSHOT", -1, 1, hash(raw), ""]];
  assert.equal(S.decodeSnapshot(rows, hash, ["SNAPSHOT"]).revision, 3);
  rows[0][5] = "{}";
  assert.throws(() => S.decodeSnapshot(rows, hash, ["SNAPSHOT"]), /DISPATCH_SNAPSHOT_CORRUPT/);
});
test("Finance latest limit wins, not maximum; credit fallback only when no Finance record", () => {
  const c = M.chosenCustomer([{ app: "FIN", key: "FIN:1", TEN: "KH", MST: "", DIEN_THOAI: [], CHO_PHEP_NO: true, HAN_MUC_NO: 1e3, updated_at: "2025-01-01" }, { app: "FIN", key: "FIN:2", TEN: "KH", MST: "", DIEN_THOAI: [], CHO_PHEP_NO: false, HAN_MUC_NO: 0, updated_at: "2026-01-01" }, { app: "DISPATCH", key: "DISPATCH:1", TEN: "KH", MST: "", DIEN_THOAI: [], CHO_PHEP_NO: true, updated_at: null }]);
  assert.equal(c.CHO_PHEP_NO, false);
  assert.equal(c.HAN_MUC_NO, 0);
});
test("latest known source phone/address wins, original rows are retained separately", () => {
  const rows = [{ app: "SALE", key: "SALE:1", TEN: "Hóa đơn", MST: "0101234567", DIEN_THOAI: ["0901234567"], DIA_CHI: "Cũ", updated_at: "2025-01-01" }, { app: "CARE", key: "CARE:1", TEN: "Tên liên hệ", MST: "", DIEN_THOAI: ["0912345678", "0923456789"], DIA_CHI: "Mới", updated_at: "2026-10-15" }];
  const c = M.chosenCustomer(rows);
  assert.equal(c.TEN, "Hóa đơn");
  assert.deepEqual(c.DIEN_THOAI, ["0912345678", "0923456789"]);
  assert.equal(c.DIA_CHI, "Mới");
  assert.deepEqual(rows[0].DIEN_THOAI, ["0901234567"]);
});

test("numeric CARE phone reaches source normalization without strict live-phone rejection, finance fields remain typed", () => {
  const r=S.fromTables("CARE",{"Khách hàng":{headers:["Mã khách hàng","Tên khách hàng","Số điện thoại","Địa chỉ","Công ty"],rows:[["C1","Liên hệ",2837542072,"Source address","Company"]]}})[0];
  assert.equal(r.DIEN_THOAI,2837542072);
  const normalized=M.normalize(r);assert.deepEqual(normalized.DIEN_THOAI,["02837542072"]);assert.deepEqual(normalized.NGUOI_LIEN_HE[0].dien_thoai,["02837542072"]);
});
