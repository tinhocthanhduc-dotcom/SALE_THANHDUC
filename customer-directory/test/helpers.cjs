"use strict";
const crypto = require("node:crypto"), { Repository, MemoryDriver } = require("../repository.cjs"), { SheetsDriver, SCHEMA } = require("../sheets.cjs");
const actors = { sales: { id: "sales@example.test", roles: ["sales"] }, reception: { id: "reception@example.test", roles: ["reception"] }, dispatcher: { id: "dispatch@example.test", roles: ["dispatcher"] }, finance: { id: "finance@example.test", roles: ["finance"] }, director: { id: "director@example.test", roles: ["director"] }, both: { id: "both@example.test", roles: ["finance", "director"] } };
const hash = (s) => crypto.createHash("sha256").update(s).digest("hex");
class Sheet {
  constructor(name) {
    this.name = name;
    this.rows = [];
  }
  getLastRow() {
    let i = this.rows.length;
    while (i && !this.rows[i - 1]?.some((x) => x !== "" && x != null)) i--;
    return i;
  }
  getRange(row, col, height = 1, width = 1) {
    const sh = this;
    return { getDisplayValues: () => Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_2, j) => String(sh.rows[row + i - 1]?.[col + j - 1] ?? ""))), setValues(values) {
      var _a, _b;
      for (let i = 0; i < height; i++) {
        (_a = sh.rows)[_b = row + i - 1] || (_a[_b] = []);
        for (let j = 0; j < width; j++) sh.rows[row + i - 1][col + j - 1] = String(values[i][j] ?? "");
      }
    }, clearContent() {
      this.setValues(Array.from({ length: height }, () => Array(width).fill("")));
    } };
  }
}
function sheetDriver(fault = () => {
}) {
  const sheets = Object.fromEntries(Object.keys(SCHEMA).map((k) => [k, new Sheet(k)])), wb = { getId: () => "directory-copy", getSheetByName: (name) => sheets[name] }, properties = { values: { CD_COUNTER: "0" }, getProperty(k) {
    return this.values[k] ?? null;
  }, setProperty(k, v) {
    this.values[k] = v;
  } }, writeRows = (s, start, rows) => {
    if (rows.length) s.getRange(start, 1, rows.length, rows[0].length).setValues(rows);
  };
  for (const [name, header] of Object.entries(SCHEMA)) writeRows(sheets[name], 1, [header]);
  writeRows(sheets.CD_META, 2, [["ENV", "COPY"], ["SCRIPT_ID", "directory-script"], ["TOKEN", "private-fixture"], ["COUNTER", "0"], ["REVISION", "0"]]);
  let locked = false;
  const options = { workbook: wb, workbookId: "directory-copy", scriptId: "directory-script", marker: "private-fixture", properties, lock(fn) {
    if (locked) throw Error("LOCK_BUSY");
    locked = true;
    try {
      return fn();
    } finally {
      locked = false;
    }
  }, writeRows, flush: () => {
  }, hash, id: () => crypto.randomUUID(), fault }, driver = new SheetsDriver(options);
  return { driver, sheets, properties, options, wb };
}
function fixture(driver = new MemoryDriver()) {
  let n = 0;
  const repo = new Repository(driver, { hash, now: () => "2026-10-15T10:00:00.000Z", id: () => crypto.randomUUID() }), submit = (type, payload, who = "finance", expected_version, idempotency_key = "test-" + n++) => repo.submit({ type, payload, expected_version, idempotency_key }, actors[who]), create = (customer = {}, who = "finance") => submit("create", { customer: { TEN: "Khách mẫu", LOAI: "CA_NHAN", ...customer } }, who).customer;
  return { repo, driver, submit, create };
}
function sourceRows() {
  return [
    { app: "SALE", ma_cu: "S1", TEN: "Công ty An", LOAI: "CONG_TY", MST: "0101234567", DIEN_THOAI: "+84 90 111 1111", DIA_CHI: "Địa chỉ hóa đơn", updated_at: "2025-01-01" },
    { app: "FIN", ma_cu: "F1", TEN: "Tên kế toán cũ", LOAI: "CONG_TY", MST: "0101234567", DIEN_THOAI: "0901111111", DIA_CHI: "Cũ", HAN_MUC_NO: 1e6, open_debt: true },
    { app: "CARE", ma_cu: "C1", TEN: "Công ty An", DIEN_THOAI: "0901111111", DIA_CHI: "Địa chỉ mới nhất", updated_at: "2026-10-14" },
    { app: "FIN", ma_cu: "F2", TEN: "Bình", DIEN_THOAI: "0912222222", open_debt: true },
    { app: "CARE", ma_cu: "C2", TEN: "Lan", DIEN_THOAI: "0912222222" },
    { app: "DISPATCH", ma_cu: "D1", TEN: "Không số", DIEN_THOAI: "", terms: "credit" },
    { app: "SALE", ma_cu: "S2", TEN: "Cùng tên", DIEN_THOAI: "0923333333" },
    { app: "CARE", ma_cu: "C3", TEN: "Cung ten", DIEN_THOAI: "0934444444" }
  ];
}
module.exports = { actors, hash, fixture, sheetDriver, sourceRows, Sheet };
