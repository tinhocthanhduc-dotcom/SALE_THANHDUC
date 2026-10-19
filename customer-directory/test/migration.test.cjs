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

test("legacy bad phones are collected together, raw preserved, valid parts alone used for matching", () => {
  const rows = [
    { app: "SALE", ma_cu: "S1", TEN: "An", DIEN_THOAI: "+84 901 234 567; abc; 123" },
    { app: "CARE", ma_cu: "C1", TEN: "An", DIEN_THOAI: "0901234567" },
    { app: "SALE", ma_cu: "S2", TEN: "Bình", DIEN_THOAI: "abc" },
    { app: "CARE", ma_cu: "C2", TEN: "Khác", DIEN_THOAI: "abc" }
  ];
  const p = M.plan(rows, {}, hash);
  assert.equal(p.report.source_rows, 4);
  assert.equal(p.report.invalid_phone_rows.length, 3);
  assert.equal(p.report.automatic_groups, 1);
  const r = p.records.find(x => x.ma_cu === "S1");
  assert.deepEqual(r.DIEN_THOAI, ["0901234567"]);
  assert.equal(r.DIEN_THOAI_GOC, rows[0].DIEN_THOAI);
  assert.deepEqual(r.DIEN_THOAI_LOI, ["abc", "123"]);
  assert.deepEqual(M.plan(p.records, {}, hash).report, p.report);
  const f = fixture();
  scan(f, rows);
  finalize(f);
  const code = f.driver.state.mappings["SALE:S1"];
  assert.deepEqual(f.driver.state.customers[code].DIEN_THOAI, ["0901234567"]);
  assert.equal(f.driver.state.sources["SALE:S1"].DIEN_THOAI_GOC, rows[0].DIEN_THOAI);
  const mappings = C.clone(f.driver.state.mappings);
  scan(f, rows); finalize(f);
  assert.deepEqual(f.driver.state.mappings, mappings);
  assert.throws(() => f.submit("create", { customer: { TEN: "Live", DIEN_THOAI: "abc" } }, "finance"), /INVALID_PHONE/);
});

test("all invalid legacy taxes collected without guessing or matching by invalid tax, rerun preserves raw", () => {
  const rows = [
    { app: "SALE", ma_cu: "S1", TEN: "A", MST: "123", DIEN_THOAI: "bad" },
    { app: "CARE", ma_cu: "C1", TEN: "B", MST: "123" },
    { app: "FIN", ma_cu: "F1", TEN: "C", MST: "030-123-4567" },
    { app: "SALE", ma_cu: "S2", TEN: "D", MST: "<bad-tax>" }
  ];
  const p = M.plan(rows, {}, hash);
  assert.equal(p.report.invalid_tax_rows.length, 3);
  assert.equal(p.report.invalid_phone_rows.length, 1);
  assert.equal(p.report.automatic_groups, 0);
  assert.equal(p.records.find(r => r.ma_cu === "F1").MST, "0301234567");
  assert.equal(p.records.find(r => r.ma_cu === "S1").LOAI, "CONG_TY");
  assert.deepEqual(M.plan(p.records, {}, hash).report, p.report);
  const f = fixture(); scan(f, rows); finalize(f);
  const mapping = C.clone(f.driver.state.mappings);
  assert.equal(f.driver.state.sources["SALE:S1"].MST_GOC, "123");
  assert.equal(f.driver.state.customers[mapping["SALE:S1"]].MST, "");
  scan(f, rows); finalize(f); assert.deepEqual(f.driver.state.mappings, mapping);
  assert.throws(() => f.submit("create", { customer: { TEN: "Live", MST: "123" } }, "finance"), /INVALID_TAX/);
});

test("source-only padding covers numeric/string mobile, landline, 9/12-digit tax with original audit and no exponents", () => {
  const row={app:"SALE",ma_cu:"001",TEN:"Nguồn",DIEN_THOAI:2837542072,MST:312345678};
  const a=M.normalize(row);
  assert.deepEqual(a.DIEN_THOAI,["02837542072"]);assert.equal(a.MST,"0312345678");
  assert.equal(a.DIEN_THOAI_GOC,"2837542072");assert.equal(a.MST_GOC,"312345678");
  assert.deepEqual(a.BU_SO_0,[{truong:"DIEN_THOAI",goc:"2837542072",sau:"02837542072"},{truong:"MST",goc:"312345678",sau:"0312345678"}]);
  assert.equal(a.ma_cu,"001");assert.deepEqual(M.normalize(a),a);
  assert.equal(M.normalize({...row,MST:312345678001}).MST,"0312345678001");
  assert.equal(M.normalize({...row,MST:"312345678001"}).MST,"0312345678001");
  assert.equal(M.normalize({...row,DIEN_THOAI:"909123456"}).DIEN_THOAI[0],"0909123456");
  assert.equal(M.normalize({...row,MST:3.12e8}).MST_GOC,"312000000");
  assert.equal(M.sourceText(1e21),"1000000000000000000000");
  assert.equal(M.normalize({...row,MST:"3.12e8"}).MST_LOI,true);
  assert.equal(M.normalize({...row,MST:"312 345 678"}).MST_LOI,true);
  assert.throws(()=>C.tax("312345678"),/INVALID_TAX/);
  assert.throws(()=>C.phones("2837542072"),/INVALID_PHONE/);
});
test("misplaced tax equal to own phone or 02x landline stays an error and transfers to phone", () => {
  for(const tax of [2837542072,"02837542072"]){
    const r=M.normalize({app:"SALE",ma_cu:"1",TEN:"A",MST:tax,DIEN_THOAI:typeof tax === "number" ? tax : ""});
    assert.equal(r.MST,"");assert.equal(r.MST_LOI_LY_DO,"MST_IS_PHONE");assert.deepEqual(r.MST_CHUYEN_SDT,["02837542072"]);assert.deepEqual(r.DIEN_THOAI,["02837542072"]);
    assert.deepEqual(M.normalize(r),r);
  }
  const r=M.normalize({app:"FIN",ma_cu:"2",TEN:"B",DIEN_THOAI:"+84 909 123 456",MST:909123456});
  assert.equal(r.MST,"");assert.equal(r.MST_LOI,true);assert.deepEqual(r.DIEN_THOAI,["0909123456"]);
  assert.equal(M.normalize({app:"SALE",ma_cu:"3",TEN:"C",MST:"0312345678001"}).MST,"0312345678001");
  assert.equal(M.normalize({app:"SALE",ma_cu:"4",TEN:"D",MST:"2837542072"}).MST,"2837542072");
});
test("rescan repairs old imported numbers with audit, preserves KTD/counter and reruns without new repairs", () => {
  const f=fixture(),row={app:"SALE",ma_cu:"S",TEN:"Source",DIEN_THOAI:2837542072,MST:312345678};
  // Simulate data allocated by the pre-fix importer, including old source evidence.
  scan(f,[{...row,DIEN_THOAI:"",MST:""}]);finalize(f);
  const code=f.driver.state.mappings["SALE:S"],counter=f.driver.counter;
  Object.assign(f.driver.state.sources["SALE:S"],{DIEN_THOAI_GOC:"2837542072",DIEN_THOAI:[],MST_GOC:"312345678",MST:""});
  const result=scan(f,[row]);assert.equal(result.repaired_customers,1);
  assert.equal(f.driver.state.customers[code].MST,"0312345678");assert.deepEqual(f.driver.state.customers[code].DIEN_THOAI,["02837542072"]);
  assert.equal(f.driver.state.history.filter(e=>e.LOAI==="CHUAN_HOA_SO_0").length,1);
  assert.equal(scan(f,[row]).repaired_customers,0);finalize(f);
  assert.equal(f.driver.state.mappings["SALE:S"],code);assert.equal(f.driver.counter,counter);
});
test("rescan does not overwrite manual tax/contact edits, allocate new codes or auto merge code collisions", () => {
  const f=fixture(),row={app:"SALE",ma_cu:"S",TEN:"Source",DIEN_THOAI:"",MST:""};
  scan(f,[row]);finalize(f);const code=f.driver.state.mappings["SALE:S"];
  Object.assign(f.driver.state.sources["SALE:S"],{MST_GOC:"312345678",MST:""});
  const old=f.driver.state.customers[code];f.submit("update",{ma:code,customer:{MST:"0319999999",DIEN_THOAI:"0912345678"}},"finance",old.VERSION);
  scan(f,[{...row,MST:312345678,DIEN_THOAI:2837542072}]);
  assert.equal(f.driver.state.customers[code].MST,"0319999999");assert.deepEqual(f.driver.state.customers[code].DIEN_THOAI,["0912345678"]);
  assert.equal(f.driver.counter,1);
});

test("rescan moves a legacy phone mistakenly stored as MST without changing the customer code", () => {
  const f=fixture();scan(f,[{app:"SALE",ma_cu:"S",TEN:"A",MST:""}]);finalize(f);
  const code=f.driver.state.mappings["SALE:S"];
  Object.assign(f.driver.state.sources["SALE:S"],{MST_GOC:"2837542072",MST:"2837542072"});
  f.driver.state.customers[code].MST="2837542072";
  scan(f,[{app:"SALE",ma_cu:"S",TEN:"A",MST:2837542072,DIEN_THOAI:2837542072}]);
  assert.equal(f.driver.state.customers[code].MST,"");assert.deepEqual(f.driver.state.customers[code].DIEN_THOAI,["02837542072"]);assert.equal(f.driver.counter,1);
});
test("normalization audit metadata alone preserves existing accounting decisions and approval versions", () => {
  const f=fixture();scan(f);
  const review=Object.values(f.driver.state.reviews).find(r=>!r.open_debt);
  approve(f,review,"KHAC_KHACH");const old=f.driver.state.reviews[review.id];
  old.fingerprint="old-normalizer-fingerprint";
  for(const row of old.rows)for(const field of ["BU_SO_0","NGUOI_LIEN_HE_GOC","MST_LOI_LY_DO","MST_CHUYEN_SDT"])delete row[field];
  const version=old.VERSION;
  scan(f);const next=f.driver.state.reviews[review.id];assert.equal(next.VERSION,version);assert.equal(next.decision,"KHAC_KHACH");assert.equal(next.changed_since_approval,false);
});

test("restored tax collision retains both allocated codes and requires director merge instead of reallocation", () => {
  const f=fixture(),rows=[{app:"SALE",ma_cu:"S1",TEN:"A",MST:""},{app:"CARE",ma_cu:"C1",TEN:"B",MST:"0312345678"}];
  scan(f,rows);finalize(f);const map=C.clone(f.driver.state.mappings);
  f.driver.state.sources["SALE:S1"].MST_GOC="312345678";
  scan(f,[{...rows[0],MST:312345678},rows[1]]);
  assert.deepEqual(f.driver.state.mappings,map);assert.equal(f.driver.counter,2);
  assert.equal(f.driver.state.customers[map["SALE:S1"]].MST,"");
  assert.throws(()=>finalize(f),/EXISTING_GROUPS_NEED_DIRECTOR_MERGE/);
});

test("rescan repairs zeros lost in KHACH cells even when normalized source evidence was already correct", () => {
  const f=fixture(),rows=[{app:"SALE",ma_cu:"1",TEN:"A",DIEN_THOAI:2837542072,MST:312345678}];
  scan(f,rows);finalize(f);const code=f.driver.state.mappings["SALE:1"],counter=f.driver.counter;
  f.driver.state.customers[code].DIEN_THOAI=["2837542072"];f.driver.state.customers[code].MST="312345678";
  assert.equal(scan(f,rows).repaired_customers,1);
  assert.equal(f.driver.state.customers[code].MST,"0312345678");assert.deepEqual(f.driver.state.customers[code].DIEN_THOAI,["02837542072"]);
  assert.equal(f.driver.counter,counter);assert.equal(scan(f,rows).repaired_customers,0);
});
