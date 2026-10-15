"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), M = require("../migration.cjs"), C = require("../core.cjs"), { fixture, sourceRows, hash } = require("./helpers.cjs");
const scan = (f, rows = sourceRows()) => f.submit("scan_import", { rows }, "finance", f.driver.state.revision), finalize = (f) => f.submit("finalize_import", {}, "finance", f.driver.state.revision), approve = (f, r, decision = "CUNG_KHACH") => f.submit("review_import", { id: r.id, decision, reason: "Đã đối chiếu bản sao" }, "finance", r.VERSION), confirm = (f, r) => f.submit("review_import", { id: r.id, director: true, reason: "Giám đốc xác nhận nợ" }, "director", r.VERSION);
test("normalize source, exact tax/name+phone matching, no-phone rows and debt first review types", () => {
  const p = M.plan(sourceRows(), {}, hash);
  assert.equal(p.report.source_rows, 8);
  assert.equal(p.report.missing_phone_and_tax, 1);
  assert.equal(p.report.automatic_groups, 1);
  assert.equal(p.autoGroups.find((g) => g.keys.includes("SALE:S1")).keys.length, 3);
  assert(Object.values(p.reviews).some((r) => r.kind === "AUTO_DEBT"));
  assert(Object.values(p.reviews).some((r) => r.keys.includes("FIN:F2") && r.open_debt));
});
test("accounting decisions and separate director approval gate debt groups, including exact matches", () => {
  const f = fixture();
  scan(f);
  const early = finalize(f);
  assert.equal(early.allocated, 1);
  assert.equal(Object.keys(f.driver.state.mappings).length, 1);
  const r = Object.values(f.driver.state.reviews).find((r2) => r2.kind === "AUTO_DEBT");
  assert.throws(() => f.submit("review_import", { id: r.id, decision: "CUNG_KHACH", reason: "x" }, "sales", 1), /FORBIDDEN/);
  approve(f, r);
  assert.equal(finalize(f).allocated, 0);
  const next = f.driver.state.reviews[r.id];
  assert.throws(() => f.submit("review_import", { id: r.id, director: true, reason: "x" }, "finance", next.VERSION), /FORBIDDEN/);
  confirm(f, next);
  const applied = finalize(f);
  assert.equal(applied.allocated, 1);
  const code = f.driver.state.mappings["SALE:S1"], c = f.driver.state.customers[code];
  assert.equal(c.TEN, "Công ty An");
  assert.equal(c.MST, "0101234567");
  assert.equal(c.DIA_CHI, "Địa chỉ mới nhất");
  assert.equal(c.HAN_MUC_NO, 1e6);
  assert.equal(c.CHO_PHEP_NO, true);
  assert.equal(f.driver.state.mappings["FIN:F1"], code);
});
test("rerun scan preserves approvals and KTD, finalize again allocates nothing", () => {
  const f = fixture();
  scan(f);
  for (const r of Object.values(f.driver.state.reviews)) {
    approve(f, r, r.kind === "AUTO_DEBT" ? "CUNG_KHACH" : "KHAC_KHACH");
    if (r.open_debt) confirm(f, f.driver.state.reviews[r.id]);
  }
  const a = finalize(f);
  assert.equal(a.pending, 0);
  const mappings = C.clone(f.driver.state.mappings), counter = f.driver.counter;
  scan(f);
  const b = finalize(f);
  assert.equal(b.allocated, 0);
  assert.equal(f.driver.counter, counter);
  assert.deepEqual(f.driver.state.mappings, mappings);
  assert(Object.values(f.driver.state.reviews).every((r) => r.approved_by));
});
test("source changes invalidate old decisions, keep history and mapped codes", () => {
  const f = fixture();
  scan(f);
  const r = Object.values(f.driver.state.reviews).find((r2) => r2.kind === "AUTO_DEBT");
  approve(f, r);
  confirm(f, f.driver.state.reviews[r.id]);
  finalize(f);
  const code = f.driver.state.mappings["SALE:S1"], rows = sourceRows();
  rows[0].DIA_CHI = "Địa chỉ thay đổi";
  scan(f, rows);
  assert.equal(f.driver.state.reviews[r.id].decision, null);
  assert.equal(f.driver.state.reviews[r.id].changed_since_approval, true);
  assert.equal(f.driver.state.mappings["SALE:S1"], code);
  assert(f.driver.state.history.some((e) => e.LOAI === "KT_DUYET_TRUNG"));
});
test("cannot self-confirm using dual role, cannot stale approve or fake approver", () => {
  const f = fixture();
  scan(f);
  const r = Object.values(f.driver.state.reviews).find((r2) => r2.open_debt);
  f.submit("review_import", { id: r.id, decision: "CUNG_KHACH", reason: "x", approved_by: "forged" }, "both", 1);
  assert.equal(f.driver.state.reviews[r.id].approved_by, "both@example.test");
  assert.throws(() => f.submit("review_import", { id: r.id, director: true, reason: "x" }, "both", 2), /SECOND_APPROVER_REQUIRED/);
  assert.throws(() => approve(f, r), /VERSION_CONFLICT/);
});
test("conflicting MST cannot join through phone bridge; all decisions must be consistent", () => {
  const rows = [{ app: "SALE", ma_cu: "A", TEN: "Cùng", MST: "0101234567", DIEN_THOAI: "0901234567" }, { app: "CARE", ma_cu: "B", TEN: "Cùng", DIEN_THOAI: "0901234567" }, { app: "FIN", ma_cu: "C", TEN: "Cùng", MST: "0201234567", DIEN_THOAI: "0901234567" }];
  const p = M.plan(rows, {}, hash);
  assert.equal(p.autoGroups.length, 2);
  assert.equal(Object.keys(p.reviews).length, 1);
});
test("new group never silently merges already allocated distinct KTD records", () => {
  const f = fixture(), rows = [{ app: "SALE", ma_cu: "1", TEN: "Một", DIEN_THOAI: "0901234567" }, { app: "CARE", ma_cu: "2", TEN: "Hai", DIEN_THOAI: "0912345678" }];
  scan(f, rows);
  finalize(f);
  rows[1].TEN = "Một";
  rows[1].DIEN_THOAI = "0901234567";
  scan(f, rows);
  assert.throws(() => finalize(f), /EXISTING_GROUPS_NEED_DIRECTOR_MERGE/);
  assert.equal(Object.keys(f.driver.state.customers).length, 2);
});
test("different decisions that become same transitively block instead of dropping the disagreement", () => {
  const f = fixture(), rows = ["A", "B", "C"].map((n, i) => ({ app: ["SALE", "CARE", "FIN"][i], ma_cu: n, TEN: "Trùng tên", DIEN_THOAI: "090123456" + i }));
  scan(f, rows);
  const reviews = Object.values(f.driver.state.reviews);
  for (let i = 0; i < reviews.length; i++) approve(f, reviews[i], i === 2 ? "KHAC_KHACH" : "CUNG_KHACH");
  assert.throws(() => finalize(f), /CONTRADICTORY_DECISIONS/);
});
test("removed source keys fail closed after allocation; missing IDs never get row-number identities", () => {
  const f = fixture();
  scan(f, [{ app: "SALE", ma_cu: "A", TEN: "A" }]);
  finalize(f);
  assert.throws(() => scan(f, []), /MAPPED_SOURCE_REMOVED/);
  assert.throws(() => M.plan([{ app: "CARE", TEN: "No ID" }], {}, hash), /SOURCE_ID_REQUIRED/);
});
test("bounded finalize batches remain stable and can finish with new command keys", () => {
  const f = fixture(), rows = Array.from({ length: 7 }, (_, i) => ({ app: "SALE", ma_cu: "S" + i, TEN: "Khách khác " + i }));
  scan(f, rows);
  const a = f.submit("finalize_import", { limit: 3 }, "finance", f.driver.state.revision);
  assert.equal(a.allocated, 3);
  assert.equal(a.remaining, 4);
  finalize(f);
  assert.equal(Object.keys(f.driver.state.mappings).length, 7);
});
test("a rescanned changed review never reuses its old version", () => {
  const f = fixture();
  scan(f);
  const r = Object.values(f.driver.state.reviews).find((r2) => r2.kind === "AUTO_DEBT"), rows = sourceRows();
  rows[0].DIA_CHI = "Nội dung mới";
  scan(f, rows);
  assert(f.driver.state.reviews[r.id].VERSION > r.VERSION);
  assert.throws(() => approve(f, r), /VERSION_CONFLICT/);
});
test("manual master collisions do not silently create a second canonical customer", () => {
  const f = fixture();
  f.create({ TEN: "Đã có", LOAI: "CONG_TY", MST: "0101234567" });
  scan(f, [{ app: "SALE", ma_cu: "1", TEN: "Nguồn nhập", MST: "0101234567" }]);
  assert.throws(() => finalize(f), /MASTER_CUSTOMER_CONFLICT/);
  assert.equal(Object.keys(f.driver.state.customers).length, 1);
});
test("director without accounting role cannot finalize automatic migration approvals", () => {
  const f = fixture();
  scan(f, [{ app: "SALE", ma_cu: "1", TEN: "Một" }]);
  assert.throws(() => f.submit("finalize_import", {}, "director", f.driver.state.revision), /FORBIDDEN/);
});
test("Finance ID and display code, Dispatch UUID and customer_no all map without duplicate customers on rerun", () => {
  const f = fixture(), rows = [{ app: "FIN", ma_cu: "uuid-fin", aliases: ["KH000045"], TEN: "Một khách", MST: "0101234567" }, { app: "DISPATCH", ma_cu: "uuid-dispatch", aliases: ["KH-20261015-0001"], TEN: "Một khách", MST: "0101234567" }];
  scan(f, rows);
  finalize(f);
  const state = f.driver.state, code = state.mappings["FIN:uuid-fin"];
  assert.equal(state.mappings["FIN:KH000045"], code);
  assert.equal(state.mappings["DISPATCH:KH-20261015-0001"], code);
  assert.equal(C.get(state, "FIN:KH000045").MA_KHACH, code);
  scan(f, rows);
  assert.equal(finalize(f).allocated, 0);
  assert.throws(() => M.plan([...rows, { app: "FIN", ma_cu: "other", aliases: ["KH000045"], TEN: "Khác" }], {}, hash), /AMBIGUOUS_SOURCE_ALIAS/);
});
test("equivalent source field order does not invalidate a reviewed group", () => {
  const f = fixture();
  scan(f);
  const r = Object.values(f.driver.state.reviews).find((r2) => r2.kind === "AUTO_DEBT");
  approve(f, r);
  confirm(f, f.driver.state.reviews[r.id]);
  scan(f, sourceRows().map((row) => Object.fromEntries(Object.entries(row).reverse())));
  assert.equal(f.driver.state.reviews[r.id].decision, "CUNG_KHACH");
  assert.equal(f.driver.state.reviews[r.id].director_by, "director@example.test");
});
