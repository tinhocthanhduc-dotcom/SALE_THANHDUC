"use strict";
const C = require("./core.cjs"), { stable, query } = require("./repository.cjs");
const SCHEMA = {
  KHACH: ["MA_KHACH", "LOAI", "TEN", "MST", "DIEN_THOAI", "EMAIL", "DIA_CHI", "NGUOI_LIEN_HE", "CHO_PHEP_NO", "TRANG_THAI", "GOP_VAO", "MA_CU", "VERSION", "TAO_LUC", "TAO_BOI", "CAP_NHAT_LUC", "CAP_NHAT_BOI", "HAN_MUC_NO", "GHI_CHU"],
  LICH_SU: ["ID", "LOAI", "MA_KHACH", "TRUOC", "SAU", "AI", "LUC", "LY_DO"],
  CHI_MUC: ["ID", "LOAI", "GIA_TRI", "KHONG_DAU", "MA_KHACH"],
  NGUON: ["ID", "APP", "MA_CU", "DU_LIEU"],
  DUYET_TRUNG: ["ID", "CO_CONG_NO_MO", "SO_DONG", "LUA_CHON_NHAP", "QUYET_DINH", "KT_DUYET_BOI", "GD_XAC_NHAN_BOI", "VERSION", "CHI_TIET", "LY_DO_NHAP", "DONG_NGUON"],
  ANH_XA: ["ID", "APP", "MA_CU", "MA_KHACH"],
  CD_RECEIPTS: ["KEY", "HASH", "RESULT", "REVISION"],
  CD_JOURNAL: ["TX", "KIND", "INDEX", "COUNT", "HASH", "PAYLOAD"],
  CD_META: ["KEY", "VALUE"]
};
const ORIGINAL_IDS = ["1tHd_ypY36P0cyFFcPoDjVuPobU2y4k1__nR4cLZdsYY", "1-j45sURspD4PvrymNp8P2gLwrebFRVt9Rbo3AwEiDWw", "1R5YaLosDq7fhUJuulfjXoJYEOA4tZief5Ge5qaL_jrs", "1Nuwjjj2HpirYJA9YUppkQ_kSVpVo6LH4ShN14NkOMZU", "1ACsqTWveQR3ksIwE3bkQcN7RNI1a7MymtOOgJRp72yw"];
function rowsFor(d) {
  return { KHACH: Object.values(d.customers).map((c) => SCHEMA.KHACH.map((k) => k === "DIEN_THOAI" || k === "MA_CU" ? c[k].join("; ") : k === "NGUOI_LIEN_HE" ? JSON.stringify(c[k]) : c[k] ?? "")), LICH_SU: d.history.map((e) => SCHEMA.LICH_SU.map((k) => ["TRUOC", "SAU"].includes(k) ? JSON.stringify(e[k]) : e[k] ?? "")), NGUON: Object.values(d.sources).map((r) => [r.key, r.app, r.ma_cu, JSON.stringify(r)]), DUYET_TRUNG: Object.values(d.reviews).map((r) => [r.id, r.open_debt ? "Có" : "Không", r.keys.length, "", r.decision === "CUNG_KHACH" ? "Cùng khách" : r.decision === "KHAC_KHACH" ? "Khác khách" : "", r.approved_by || "", r.director_by || "", r.VERSION, JSON.stringify(r), "", (r.rows || []).map((x) => [x.app, x.ma_cu, x.TEN, x.DIEN_THOAI.join(", "), x.MST, x.DIA_CHI, x.open_debt ? "Có nợ mở" : ""].join(" | ")).join("\n")]), ANH_XA: Object.entries(d.mappings).map(([key, code]) => {
    const i = key.indexOf(":");
    return [key, key.slice(0, i), key.slice(i + 1), code];
  }) };
}
class SheetsDriver {
  constructor({ workbook, workbookId, scriptId, marker, properties, lock, writeRows, flush, hash, id, fault = () => {
  } }) {
    if (!workbookId || workbookId !== workbook.getId() || ORIGINAL_IDS.includes(workbookId)) C.fail("COPY_TARGET_REQUIRED");
    Object.assign(this, { wb: workbook, scriptId, marker, props: properties, lock, writeRows, flush, hash, id, fault });
    this.validate();
  }
  table(name) {
    const s = this.wb.getSheetByName(name);
    if (!s) C.fail("SCHEMA_MISMATCH");
    return s;
  }
  rows(name) {
    const s = this.table(name), n = s.getLastRow();
    return n < 2 ? [] : s.getRange(2, 1, n - 1, SCHEMA[name].length).getDisplayValues().filter((r) => r.some((v) => v !== ""));
  }
  meta(key) {
    const r = this.rows("CD_META").find((r2) => r2[0] === key);
    return r ? r[1] : null;
  }
  setMeta(key, value) {
    const all = this.rows("CD_META"), i = all.findIndex((r) => r[0] === key);
    this.writeRows(this.table("CD_META"), i < 0 ? all.length + 2 : i + 2, [[key, String(value)]]);
  }
  validate() {
    const revision = this.meta("REVISION");
    if (revision === null || !/^\d+$/.test(revision) || !Number.isSafeInteger(Number(revision))) C.fail("META_CORRUPT");
    if (!this.marker || this.meta("ENV") !== "COPY" || this.meta("SCRIPT_ID") !== this.scriptId || this.meta("TOKEN") !== this.marker) C.fail("COPY_MARKER_MISMATCH");
    for (const [name, headers] of Object.entries(SCHEMA)) if (stable(this.table(name).getRange(1, 1, 1, headers.length).getDisplayValues()[0]) !== stable(headers)) C.fail("SCHEMA_MISMATCH");
  }
  allocate() {
    const a = this.props.getProperty("CD_COUNTER"), b = this.meta("COUNTER");
    if (a === null && b === null) C.fail("COUNTER_MISSING");
    if (a !== null && !/^\d+$/.test(a) || b !== null && !/^\d+$/.test(b)) C.fail("COUNTER_CORRUPT");
    const n = Math.max(Number(a || 0), Number(b || 0)), last = Math.max(0, ...this.rows("KHACH").map((r) => /^KTD-\d{6}$/.test(r[0]) ? Number(r[0].slice(4)) : 0));
    if (n < last) C.fail("COUNTER_REGRESSED");
    if (!Number.isSafeInteger(n) || n < 0 || n >= 999999) C.fail("COUNTER_EXHAUSTED");
    this.props.setProperty("CD_COUNTER", String(n + 1));
    this.setMeta("COUNTER", n + 1);
    this.flush();
    return "KTD-" + String(n + 1).padStart(6, "0");
  }
  read() {
    const s = C.initial();
    s.revision = Number(this.meta("REVISION") || 0);
    for (const row of this.rows("KHACH")) {
      const c = Object.fromEntries(SCHEMA.KHACH.map((k, i) => [k, row[i]]));
      for (const k of ["DIEN_THOAI", "MA_CU"]) c[k] = c[k] ? c[k].split(/;\s*/) : [];
      c.NGUOI_LIEN_HE = JSON.parse(c.NGUOI_LIEN_HE || "[]");
      c.VERSION = Number(c.VERSION);
      c.HAN_MUC_NO = Number(c.HAN_MUC_NO || 0);
      c.CHO_PHEP_NO = c.CHO_PHEP_NO === "true";
      s.customers[c.MA_KHACH] = c;
    }
    for (const r of this.rows("NGUON")) s.sources[r[0]] = JSON.parse(r[3]);
    for (const r of this.rows("DUYET_TRUNG")) s.reviews[r[0]] = JSON.parse(r[8]);
    for (const r of this.rows("ANH_XA")) s.mappings[r[0]] = r[3];
    for (const r of this.rows("LICH_SU")) {
      const e = Object.fromEntries(SCHEMA.LICH_SU.map((k, i) => [k, r[i]]));
      e.TRUOC = JSON.parse(e.TRUOC || "null");
      e.SAU = JSON.parse(e.SAU || "null");
      s.history.push(e);
    }
    return s;
  }
  transactions() {
    const all = this.rows("CD_JOURNAL"), prepared = all.filter((r) => r[1] === "PREPARED"), out = [];
    for (const m of prepared) {
      const n = Number(m[3]), parts = all.filter((r) => r[0] === m[0] && r[1] === "DATA").sort((a, b) => Number(a[2]) - Number(b[2]));
      if (parts.length !== n || parts.some((p, i) => Number(p[2]) !== i || p[4] !== m[4] || Number(p[3]) !== n)) C.fail("JOURNAL_CORRUPT");
      const raw = parts.map((r) => r[5]).join("");
      if (this.hash(raw) !== m[4]) C.fail("JOURNAL_CORRUPT");
      const t = JSON.parse(raw);
      if (t.id !== m[0]) C.fail("JOURNAL_CORRUPT");
      out.push({ t, committed: all.some((r) => r[0] === t.id && r[1] === "COMMITTED") });
    }
    return out.sort((a, b) => a.t.base_revision - b.t.base_revision);
  }
  receipt(key) {
    const rows = this.rows("CD_RECEIPTS"), found = rows.filter((r) => r[0] === key);
    if (found.length > 1) C.fail("JOURNAL_CONFLICT");
    return found.length ? { hash: found[0][1], result: JSON.parse(found[0][2]) } : null;
  }
  prepare(t) {
    if (JSON.stringify(t.result).length > 4e4) C.fail("ROW_TOO_LARGE");
    const tables = rowsFor(t.delta);
    for (const rows of Object.values(tables)) for (const row of rows) for (const v of row) if (String(v).length > 4e4) C.fail("ROW_TOO_LARGE");
    const raw = JSON.stringify(t);
    if (raw.length > 8e6) C.fail("TRANSACTION_TOO_LARGE");
    const parts = [];
    for (let i = 0; i < raw.length; ) {
      let end = Math.min(i + 15e3, raw.length);
      if (end < raw.length && /[\uD800-\uDBFF]/.test(raw[end - 1])) end--;
      parts.push(raw.slice(i, end));
      i = end;
    }
    const digest = this.hash(raw), sheet = this.table("CD_JOURNAL");
    this.writeRows(sheet, sheet.getLastRow() + 1, parts.map((p, i) => [t.id, "DATA", i, parts.length, digest, p]));
    this.flush();
    this.fault("chunks");
    this.writeRows(sheet, sheet.getLastRow() + 1, [[t.id, "PREPARED", -1, parts.length, digest, ""]]);
    this.flush();
    if (!this.transactions().some((x) => x.t.id === t.id)) C.fail("JOURNAL_CORRUPT");
    this.fault("prepared");
  }
  upsert(name, newRows, removed = []) {
    const sheet = this.table(name), rows = this.rows(name), map = new Map(rows.map((r, i) => [r[0], i]));
    if (removed.length || name === "DUYET_TRUNG" && newRows.length) {
      const merged = new Map(rows.filter((r) => !removed.includes(r[0])).map((r) => [r[0], r]));
      for (const r of newRows) merged.set(r[0], r);
      const next2 = [...merged.values()];
      if (name === "DUYET_TRUNG") next2.sort((a, b) => Number(a[1] !== "Có") - Number(b[1] !== "Có") || a[0].localeCompare(b[0]));
      if (next2.length) this.writeRows(sheet, 2, next2);
      if (rows.length > next2.length) sheet.getRange(next2.length + 2, 1, rows.length - next2.length, SCHEMA[name].length).clearContent();
      return;
    }
    const writes = [];
    let next = rows.length;
    for (const row of newRows) {
      const i = map.has(row[0]) ? map.get(row[0]) : next++;
      writes.push({ i: i + 2, row });
    }
    writes.sort((a, b) => a.i - b.i);
    for (let start = 0; start < writes.length; ) {
      let end = start + 1;
      while (end < writes.length && writes[end].i === writes[end - 1].i + 1) end++;
      this.writeRows(sheet, writes[start].i, writes.slice(start, end).map((w) => w.row));
      start = end;
    }
  }
  apply(t) {
    const revision = Number(this.meta("REVISION") || 0);
    if (revision !== t.base_revision && revision !== t.delta.revision) C.fail("RECOVERY_CONFLICT");
    if (revision === t.delta.revision) return;
    const tables = rowsFor(t.delta), removed = { KHACH: t.delta.customers_removed, NGUON: t.delta.sources_removed, DUYET_TRUNG: t.delta.reviews_removed, ANH_XA: t.delta.mappings_removed };
    for (const [name, rows] of Object.entries(tables)) {
      this.upsert(name, rows, removed[name] || []);
      this.fault(name);
    }
    if (Object.keys(t.delta.customers).length) {
      const index = [];
      for (const c of Object.values(this.read().customers)) {
        const entries = [["TEN", c.TEN], ["MA", c.MA_KHACH], ["DIA_CHI", c.DIA_CHI], ["MST", c.MST], ...c.DIEN_THOAI.map((p) => ["SDT", p]), ...c.NGUOI_LIEN_HE.flatMap((p) => p.dien_thoai.map((n) => ["SDT", n])), ...c.MA_CU.map((p) => ["MA_CU", p])];
        for (const [kind, value] of entries) if (value) index.push([this.hash(c.MA_KHACH + "|" + kind + "|" + value), kind, value, C.fold(value), c.MA_KHACH]);
      }
      const old = this.rows("CHI_MUC");
      if (index.length) this.writeRows(this.table("CHI_MUC"), 2, index);
      if (old.length > index.length) this.table("CHI_MUC").getRange(index.length + 2, 1, old.length - index.length, SCHEMA.CHI_MUC.length).clearContent();
    }
    this.flush();
    this.fault("projections");
    this.setMeta("REVISION", t.delta.revision);
    this.flush();
    this.fault("applied");
  }
  commit(t) {
    const old = this.receipt(t.key);
    if (old && old.hash !== t.hash) C.fail("JOURNAL_CONFLICT");
    this.upsert("CD_RECEIPTS", [[t.key, t.hash, JSON.stringify(t.result), t.delta.revision]]);
    this.flush();
    if (!this.rows("CD_JOURNAL").some((r) => r[0] === t.id && r[1] === "COMMITTED")) this.writeRows(this.table("CD_JOURNAL"), this.table("CD_JOURNAL").getLastRow() + 1, [[t.id, "COMMITTED", -1, 0, t.hash, ""]]);
    this.flush();
    this.fault("committed");
  }
  recover() {
    this.validate();
    const sheet = this.table("CD_JOURNAL");
    if (sheet.getLastRow() > 1 && sheet.getRange(sheet.getLastRow(), 2, 1, 1).getDisplayValues()[0][0] === "COMMITTED") return;
    for (const x of this.transactions()) if (!x.committed) {
      this.apply(x.t);
      this.commit(x.t);
    }
  }
  customer(ma) {
    const sheet = this.table("KHACH"), row = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 1).getDisplayValues().findIndex((r) => r[0] === ma);
    if (row < 0) C.fail("NOT_FOUND");
    const values = sheet.getRange(row + 2, 1, 1, SCHEMA.KHACH.length).getDisplayValues()[0], c = Object.fromEntries(SCHEMA.KHACH.map((k, i) => [k, values[i]]));
    c.DIEN_THOAI = c.DIEN_THOAI ? c.DIEN_THOAI.split(/;\s*/) : [];
    c.MA_CU = c.MA_CU ? c.MA_CU.split(/;\s*/) : [];
    c.NGUOI_LIEN_HE = JSON.parse(c.NGUOI_LIEN_HE || "[]");
    c.VERSION = Number(c.VERSION);
    c.HAN_MUC_NO = Number(c.HAN_MUC_NO || 0);
    c.CHO_PHEP_NO = c.CHO_PHEP_NO === "true";
    return c;
  }
  resolved(ma) {
    const visited = /* @__PURE__ */ new Set();
    let c = this.customer(ma);
    while (c.TRANG_THAI === "DA_GOP") {
      if (visited.has(c.MA_KHACH)) C.fail("MERGE_CYCLE");
      visited.add(c.MA_KHACH);
      c = this.customer(c.GOP_VAO);
    }
    return c;
  }
  query(action, p = {}) {
    if (action === "overview") return { revision: Number(this.meta("REVISION") || 0), customers: Math.max(0, this.table("KHACH").getLastRow() - 1) };
    if (action === "get") {
      let ma = p.ma;
      if (!/^KTD-\d{6}$/.test(ma)) {
        const alias = this.rows("CHI_MUC").find((r) => r[1] === "MA_CU" && r[2] === ma);
        if (!alias) C.fail("NOT_FOUND");
        ma = alias[4];
      }
      return { customer: this.resolved(ma) };
    }
    if (action === "search") {
      const q = C.fold(p.q), phone = String(p.q || "").replace(/[ () .-]/g, "").replace(/^\+84/, "0").replace(/^0084/, "0").replace(/\D/g, ""), numeric = phone && !/[a-z]/.test(q), out = [], seen = /* @__PURE__ */ new Set();
      for (const row of this.rows("CHI_MUC")) {
        if (!q && row[1] === "MA" || q && (row[3].includes(q) || numeric && ["SDT", "MST"].includes(row[1]) && row[2].includes(phone))) {
          const c = this.resolved(row[4]);
          if (!seen.has(c.MA_KHACH)) {
            out.push(c);
            seen.add(c.MA_KHACH);
          }
          if (out.length === 20) break;
        }
      }
      return { customers: out };
    }
    if (action === "history") {
      const c = this.query("get", p).customer;
      return { events: this.rows("LICH_SU").filter((r) => [c.MA_KHACH, p.ma, ...c.MA_CU.filter((k) => /^KTD-\d{6}$/.test(k))].includes(r[2])).slice(-100).reverse().map((r) => Object.fromEntries(SCHEMA.LICH_SU.map((k, i) => [k, ["TRUOC", "SAU"].includes(k) ? JSON.parse(r[i] || "null") : r[i]]))) };
    }
    return query(this.read(), action, p, this.hash);
  }
}
module.exports = { SheetsDriver, SCHEMA, ORIGINAL_IDS, rowsFor };
