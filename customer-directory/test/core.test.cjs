"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), C = require("../core.cjs"), { fixture, actors, sheetDriver, hash } = require("./helpers.cjs"), { authenticate } = require("../auth.cjs"), { stable } = require("../repository.cjs");
test("Vietnamese phones +84, spaces, 0084, missing leading zero, multiple numbers, tax branches", () => {
  assert.deepEqual(C.phones("+84 90 123 4567; 0901234567; 0084912345678; 912345678"), ["0901234567", "0912345678"]);
  assert.equal(C.tax("010 123 4567-001"), "0101234567001");
  assert.throws(() => C.phones("abc"), /INVALID_PHONE/);
  assert.throws(() => C.tax("1234"), /INVALID_TAX/);
});
test("KTD sequence ignores row positions and never reuses reserved IDs", () => {
  const f = fixture();
  assert.equal(f.create().MA_KHACH, "KTD-000001");
  f.driver.counter++;
  assert.equal(f.create({ TEN: "Khách 2" }).MA_KHACH, "KTD-000003");
});
test("duplicate company tax blocked with existing customer, no extra allocation", () => {
  const f = fixture(), c = f.create({ LOAI: "CONG_TY", MST: "0101234567" });
  assert.throws(() => f.create({ LOAI: "CONG_TY", TEN: "Tên khác", MST: "010 123 4567" }), (e) => e.code === "DUPLICATE_TAX" && e.details.existing.MA_KHACH === c.MA_KHACH);
  assert.equal(f.driver.counter, 1);
});
test("personal phone duplicates blocked; company phone requires explicit separate reason or contact", () => {
  const f = fixture();
  f.create({ DIEN_THOAI: "0901234567" });
  assert.throws(() => f.create({ DIEN_THOAI: "+84 90 123 4567" }), /DUPLICATE_PHONE/);
  const c = f.create({ LOAI: "CONG_TY", TEN: "Công ty", DIEN_THOAI: "0912345678" });
  assert.throws(() => f.create({ TEN: "Người liên hệ", DIEN_THOAI: "0912345678" }), /COMPANY_PHONE_WARNING/);
  const contact = f.submit("add_contact", { ma: c.MA_KHACH, contact: { ten: "Người liên hệ", dien_thoai: "0912345678" } }, "sales", 1).customer;
  assert.equal(contact.NGUOI_LIEN_HE.length, 1);
  const r = f.submit("create", { customer: { TEN: "Riêng", DIEN_THOAI: "0912345678" }, confirmation: { mode: "CREATE_SEPARATE", reason: "Khách cá nhân mua riêng" } }, "sales");
  assert.equal(r.warnings[0].code, "COMPANY_PHONE_SEPARATE");
});
test("same folded name only warns; name, phone substring, address, code and contacts search; max 20", () => {
  const f = fixture();
  const c = f.create({ TEN: "Nguyễn Văn An", DIEN_THOAI: "0901234567", DIA_CHI: "Thảo Điền" });
  const r = f.submit("create", { customer: { TEN: "nguyen van an" } }, "sales");
  assert(r.warnings.some((x) => x.code === "SIMILAR_NAME"));
  for (const q of ["NGUYEN", "1234567", "thao dien", c.MA_KHACH]) assert(C.search(f.driver.state, q).some((x) => x.MA_KHACH === c.MA_KHACH));
  for (let i = 0; i < 25; i++) f.create({ TEN: "Nhiều " + i });
  assert.equal(C.search(f.driver.state, "").length, 20);
});
for (const role of ["sales", "reception", "dispatcher"]) test(role + " can create/search/contact but cannot change protected fields", () => {
  const f = fixture(), c = f.create({ TEN: "Cũ" }, role);
  assert(f.repo.read("search", { q: "cu" }, actors[role]).customers.length);
  for (const customer of [{ TEN: "Mới" }, { MST: "0101234567" }, { CHO_PHEP_NO: true }, { LOAI: "CONG_TY" }, { HAN_MUC_NO: 1 }]) assert.throws(() => f.submit("update", { ma: c.MA_KHACH, customer }, role, 1), /FORBIDDEN/);
  assert.throws(() => f.create({ CHO_PHEP_NO: true }, role), /FIELD_FORBIDDEN/);
  assert.equal(f.submit("update", { ma: c.MA_KHACH, customer: { DIA_CHI: "Địa chỉ mới" } }, role, 1).customer.VERSION, 2);
});
test("finance/director protected updates allowed, stale version and unknown authoritative fields rejected", () => {
  const f = fixture(), c = f.create();
  assert.equal(f.submit("update", { ma: c.MA_KHACH, customer: { TEN: "Sửa", CHO_PHEP_NO: true } }, "director", 1).customer.VERSION, 2);
  assert.throws(() => f.submit("update", { ma: c.MA_KHACH, customer: { TEN: "Ghi đè" } }, "finance", 1), /VERSION_CONFLICT/);
  assert.throws(() => f.create({ MA_KHACH: "KTD-900000" }), /UNKNOWN_FIELD/);
});
test("director merge keeps source, history and old codes resolving to destination", () => {
  const f = fixture(), a = f.create({ TEN: "Nguồn", DIEN_THOAI: "0901234567" }), b = f.create({ TEN: "Đích" });
  f.driver.state.customers[a.MA_KHACH].MA_CU = ["SALE:KH0012"];
  assert.throws(() => f.submit("merge", { source: a.MA_KHACH, target: b.MA_KHACH, target_version: 1, reason: "Trùng" }, "finance", 1), /FORBIDDEN/);
  f.submit("merge", { source: a.MA_KHACH, target: b.MA_KHACH, target_version: 1, reason: "Đã đối chiếu" }, "director", 1);
  assert.equal(C.get(f.driver.state, a.MA_KHACH).MA_KHACH, b.MA_KHACH);
  assert.equal(C.get(f.driver.state, "SALE:KH0012").MA_KHACH, b.MA_KHACH);
  assert.equal(C.search(f.driver.state, "KH0012")[0].MA_KHACH, b.MA_KHACH);
  assert.equal(f.driver.state.customers[a.MA_KHACH].TRANG_THAI, "DA_GOP");
  assert.equal(f.driver.state.history.length, 4);
});
test("replay returns same KTD; changed payload or actor cannot reuse a key", () => {
  const f = fixture(), command = { type: "create", payload: { customer: { TEN: "Replay" } }, idempotency_key: "same" };
  const a = f.repo.submit(command, actors.sales), b = f.repo.submit(command, actors.sales);
  assert.equal(a.customer.MA_KHACH, b.customer.MA_KHACH);
  assert.equal(b.replayed, true);
  assert.equal(f.driver.counter, 1);
  assert.throws(() => f.repo.submit({ ...command, payload: { customer: { TEN: "Other" } } }, actors.sales), /IDEMPOTENCY_CONFLICT/);
  assert.throws(() => f.repo.submit(command, actors.finance), /IDEMPOTENCY_CONFLICT/);
});
for (const stage of ["prepared", "applied", "committed"]) test("durable replay recovers after " + stage, () => {
  const f = fixture();
  let once = true;
  f.driver.fault = (at) => {
    if (once && at === stage) {
      once = false;
      throw Error("Lost response");
    }
  };
  const c = { type: "create", payload: { customer: { TEN: "Recovery" } }, idempotency_key: "retry" };
  assert.throws(() => f.repo.submit(c, actors.finance), /Lost response/);
  const r = f.repo.submit(c, actors.finance);
  assert.equal(r.customer.MA_KHACH, "KTD-000001");
  assert.equal(Object.keys(f.driver.state.customers).length, 1);
  assert.equal(f.driver.state.history.length, 1);
});
test("anonymous, revoked, and imported role names do not grant access", () => {
  const f = fixture();
  assert.throws(() => f.repo.read("search", {}, null), /FORBIDDEN/);
  assert.throws(() => f.repo.read("search", {}, { ...actors.finance, active: false }), /FORBIDDEN/);
  assert.throws(() => f.repo.read("import_view", {}, actors.sales), /FORBIDDEN/);
});
test("HMAC includes actor, action, payload, timestamp; roles always server-controlled", () => {
  const hmac = (s, k) => require("node:crypto").createHmac("sha256", k).update(s).digest("hex"), ctx = { clients: { sale: { secret: "fixture-secret", actors: [actors.sales.id] } }, users: { [actors.sales.id]: actors.sales }, hmac, now: () => 1e6 };
  const body = { client_id: "sale", actor_id: actors.sales.id, timestamp: 1e6, action: "create", payload: { customer: { TEN: "Demo" } }, roles: ["director"] }, signed = { ...body, signature: hmac(stable(body), "fixture-secret") };
  assert.deepEqual(authenticate(signed, ctx).roles, ["sales"]);
  assert.throws(() => authenticate({ ...signed, action: "merge" }, ctx), /BAD_SIGNATURE/);
  assert.throws(() => authenticate(signed, { ...ctx, now: () => 14e5 }), /SIGNATURE_EXPIRED/);
  assert.throws(() => authenticate({}, ctx), /HMAC_REQUIRED/);
  assert.throws(() => authenticate({ ...signed, actor_id: actors.director.id }, ctx), /AUTH_REQUIRED/);
});
test("merged-source tax remains unique and merged contacts remain visible/searchable", () => {
  const f = fixture(), a = f.create({ TEN: "Cũ", LOAI: "CONG_TY", MST: "0101234567", NGUOI_LIEN_HE: [{ ten: "Liên hệ cũ", dien_thoai: "0901234567" }] }), b = f.create({ TEN: "Đích", LOAI: "CONG_TY", MST: "0201234567" });
  f.submit("merge", { source: a.MA_KHACH, target: b.MA_KHACH, target_version: 1, reason: "Đã xác minh" }, "director", 1);
  assert.throws(() => f.create({ TEN: "Không tạo lại mã cũ", LOAI: "CONG_TY", MST: "0101234567" }), (e) => e.code === "DUPLICATE_TAX" && e.details.existing.MA_KHACH === b.MA_KHACH);
  assert.equal(C.get(f.driver.state, b.MA_KHACH).NGUOI_LIEN_HE.length, 1);
  assert.equal(f.repo.read("history", { ma: b.MA_KHACH }, actors.finance).events.length, 4);
});
