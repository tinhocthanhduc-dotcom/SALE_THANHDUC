"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), { fixture, sheetDriver, actors } = require("./helpers.cjs"), { SheetsDriver, ORIGINAL_IDS } = require("../sheets.cjs");
test("normalized KHACH, history and phone/tax index are materialized and literal text survives", () => {
  const raw = sheetDriver(), f = fixture(raw.driver), c = f.create({ TEN: "=Tên không phải công thức", DIEN_THOAI: "+84 90 123 4567" });
  assert.equal(raw.sheets.KHACH.rows[1][0], c.MA_KHACH);
  assert(raw.sheets.CHI_MUC.rows.some((r) => r[2] === "0901234567"));
  assert.equal(f.repo.read("get", { ma: c.MA_KHACH }, actors.sales).customer.TEN, c.TEN);
  assert.equal(f.repo.read("search", { q: "+84 90 123" }, actors.sales).customers.length, 1);
  assert.equal(f.repo.read("history", { ma: c.MA_KHACH }, actors.sales).events.length, 1);
});
for (const stage of ["prepared", "KHACH", "LICH_SU", "NGUON", "DUYET_TRUNG", "ANH_XA", "projections", "applied", "committed"]) test("Sheets WAL recovery after " + stage + " preserves one ID/history/receipt", () => {
  let once = true;
  const raw = sheetDriver((at) => {
    if (once && at === stage) {
      once = false;
      throw Error("Interrupted");
    }
  }), f = fixture(raw.driver), cmd = { type: "create", payload: { customer: { TEN: "Synthetic recovery", DIEN_THOAI: "0901234567" } }, idempotency_key: "same" };
  assert.throws(() => f.repo.submit(cmd, actors.finance), /Interrupted/);
  const r = f.repo.submit(cmd, actors.finance);
  assert.equal(r.customer.MA_KHACH, "KTD-000001");
  assert.equal(raw.driver.read().history.length, 1);
  assert.equal(Object.keys(raw.driver.read().customers).length, 1);
  assert.equal(raw.sheets.CD_RECEIPTS.getLastRow(), 2);
});
test("unprepared chunks do not become customer data; a reserved number is burned", () => {
  let once = true;
  const raw = sheetDriver((at) => {
    if (once && at === "chunks") {
      once = false;
      throw Error("Interrupted");
    }
  }), f = fixture(raw.driver), c = { type: "create", payload: { customer: { TEN: "Gaps allowed" } }, idempotency_key: "key" };
  assert.throws(() => f.repo.submit(c, actors.finance));
  const r = f.repo.submit(c, actors.finance);
  assert.equal(r.customer.MA_KHACH, "KTD-000002");
  assert.equal(Object.keys(raw.driver.read().customers).length, 1);
});
test("counter mirror restores from properties if cell goes missing; original targets and wrong marker rejected", () => {
  const raw = sheetDriver(), f = fixture(raw.driver);
  f.create();
  delete raw.properties.values.CD_COUNTER;
  assert.equal(f.create({ TEN: "Second" }).MA_KHACH, "KTD-000002");
  assert.throws(() => new SheetsDriver({ ...raw.options, marker: "wrong" }), /COPY_MARKER_MISMATCH/);
  assert.throws(() => new SheetsDriver({ ...raw.options, workbookId: ORIGINAL_IDS[0] }), /COPY_TARGET_REQUIRED/);
});
test("read search uses normalized index rather than loading NGUON or all customer bodies", () => {
  const raw = sheetDriver(), f = fixture(raw.driver);
  f.create({ TEN: "Nguyễn", DIEN_THOAI: "0901234567" });
  raw.sheets.NGUON.rows.push(["bad", "APP", "ID", "not JSON"]);
  assert.equal(f.repo.read("search", { q: "nguyen" }, actors.sales).customers.length, 1);
  assert.equal(f.repo.read("get", { ma: "KTD-000001" }, actors.sales).customer.TEN, "Nguyễn");
});
test("counter corruption and both mirrors regressing cannot reuse a customer code", () => {
  const raw = sheetDriver(), f = fixture(raw.driver);
  f.create();
  raw.properties.values.CD_COUNTER = "0";
  raw.driver.setMeta("COUNTER", "0");
  assert.throws(() => f.create({ TEN: "Không tái dùng" }), /COUNTER_REGRESSED/);
  raw.properties.values.CD_COUNTER = "";
  assert.throws(() => f.create({ TEN: "Không reset" }), /COUNTER_CORRUPT/);
});
test("DUYET_TRUNG exports each source identity/details and puts open-debt groups first", () => {
  const raw = sheetDriver(), f = fixture(raw.driver);
  f.submit("scan_import", { rows: require("./helpers.cjs").sourceRows() }, "finance", 0);
  const rows = raw.driver.rows("DUYET_TRUNG");
  assert.equal(rows[0][1], "Có");
  assert(rows.some((r) => r[10].includes("SALE | S1 | Công ty An | 0901111111 | 0101234567")));
  const lastDebt = rows.map((r) => r[1]).lastIndexOf("Có"), firstNoDebt = rows.map((r) => r[1]).indexOf("Không");
  assert(firstNoDebt < 0 || lastDebt < firstNoDebt);
});

test("201 customers: full repository search reads at most six Sheets ranges/row counts for 20 or 1 result", () => {
  const raw=sheetDriver(), f=fixture(raw.driver);
  for(let i=0;i<201;i++) f.create({TEN:"Load fixture "+String(i).padStart(3,"0")});
  let calls=0, locks=0;
  for(const sh of Object.values(raw.sheets)) for(const method of ["getRange","getLastRow","getDataRange"]) {
    const original=sh[method].bind(sh); sh[method]=(...args)=>{calls++;return original(...args)};
  }
  const originalLock=raw.driver.lock; raw.driver.lock=fn=>{locks++;return originalLock(fn)};
  for(const [q,n] of [["Load fixture",20],["Load fixture 200",1]]) {
    calls=0; f.repo.driver = new SheetsDriver({...raw.options, lock: raw.driver.lock});
    const found=f.repo.read("search",{q},actors.sales).customers;
    assert.equal(found.length,n); assert(calls<=6,`search ${n} called Sheets ${calls} times`);
  }
  assert.equal(locks,0);
});
test("lock-free searches resolve merged customers and old aliases from one in-memory map", () => {
  const raw=sheetDriver(),f=fixture(raw.driver),a=f.create({TEN:"Old searchable",DIEN_THOAI:"0901234567"}),b=f.create({TEN:"Target searchable"});
  f.submit("merge",{source:a.MA_KHACH,target:b.MA_KHACH,target_version:b.VERSION,reason:"verified"},"director",a.VERSION);
  const old=f.repo.read("get",{ma:a.MA_KHACH},actors.sales).customer;
  assert.equal(old.MA_KHACH,b.MA_KHACH);
  assert.equal(f.repo.read("search",{q:a.MA_KHACH},actors.sales).customers[0].MA_KHACH,b.MA_KHACH);
  assert(f.repo.read("history",{ma:a.MA_KHACH},actors.sales).events.length);
});
test("reader during writer lock sees last committed customer, never partial new tables or LOCK_BUSY", () => {
  let f,observed;
  const raw=sheetDriver(stage=>{
    if(f && stage==="KHACH") observed=f.repo.read("search",{q:"Concurrent"},actors.sales).customers;
  });
  f=fixture(raw.driver);
  const c=f.create({TEN:"Concurrent before"});
  f.submit("update",{ma:c.MA_KHACH,customer:{TEN:"Concurrent after"}},"finance",c.VERSION);
  assert.equal(observed[0].TEN,"Concurrent before");
  assert.equal(f.repo.read("search",{q:"Concurrent"},actors.sales).customers[0].TEN,"Concurrent after");
});
test("writer starting midway through optimistic query is detected by journal fence", () => {
  const raw=sheetDriver(),f=fixture(raw.driver),c=f.create({TEN:"Fence before"});
  const original=raw.driver.query.bind(raw.driver);let once=true;
  raw.driver.query=(action,p)=>{const answer=original(action,p);if(once){once=false;f.submit("update",{ma:c.MA_KHACH,customer:{TEN:"Fence after"}},"finance",1);}return answer;};
  assert.equal(f.repo.read("search",{q:"Fence"},actors.sales).customers[0].TEN,"Fence after");
});

test("reader recovers an abandoned prepared write only when the write lock is available", () => {
  let interrupted=false;
  const raw=sheetDriver(stage=>{if(stage==="KHACH"&&!interrupted){interrupted=true;throw Error("Stopped writer")}}),f=fixture(raw.driver);
  assert.throws(()=>f.create({TEN:"Recovered by reader"}),/Stopped writer/);
  assert.equal(f.repo.read("search",{q:"Recovered"},actors.sales).customers[0].TEN,"Recovered by reader");
  assert.equal(raw.sheets.CD_JOURNAL.rows.at(-1)[1],"COMMITTED");
});
