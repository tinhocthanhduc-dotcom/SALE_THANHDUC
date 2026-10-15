"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path"), vm = require("node:vm"), crypto = require("node:crypto"), { execFileSync } = require("node:child_process"), { sheetDriver, actors } = require("./helpers.cjs"), { stable } = require("../repository.cjs");
const output = fs.mkdtempSync(path.join(os.tmpdir(), "directory-gas-"));
execFileSync(process.execPath, [path.join(__dirname, "../build-gas.cjs"), output]);
const code = fs.readFileSync(path.join(output, "Code.gs"), "utf8");
function runtime(active = actors.finance.id) {
  const raw = sheetDriver();
  let opens = 0;
  Object.assign(raw.properties.values, { CD_SETUP_AT: "2026-10-15T00:00:00.000Z", CD_ENV: "COPY", CD_ENABLE_WRITES: "true", CD_SCRIPT_ID: "directory-script", CD_WORKBOOK_ID: "directory-copy", CD_MARKER: "private-fixture", CD_USERS: JSON.stringify(Object.fromEntries(Object.values(actors).map((a) => [a.id, a]))), CD_CLIENTS: JSON.stringify({ fixture: { secret: "private-fixture-hmac", actors: [actors.finance.id, actors.sales.id] } }) });
  raw.properties.getProperties = () => ({ ...raw.properties.values });
  raw.properties.setProperties = (values) => Object.assign(raw.properties.values, values);
  raw.properties.deleteProperty = (k) => delete raw.properties.values[k];
  for (const sheet of Object.values(raw.sheets)) {
    const range = sheet.getRange.bind(sheet);
    sheet.getMaxRows = () => 1e5;
    sheet.getMaxColumns = () => 100;
    sheet.getRange = (...args) => {
      const r = range(...args);
      r.setRichTextValues = (rows) => r.setValues(rows.map((row) => row.map((v) => v.text)));
      return r;
    };
  }
  const ctx = { console: { log() {
    throw Error("No PII logs allowed");
  } }, PropertiesService: { getScriptProperties: () => raw.properties }, ScriptApp: { getScriptId: () => "directory-script" }, Session: { getActiveUser: () => ({ getEmail: () => active }), getEffectiveUser: () => ({ getEmail: () => actors.director.id }) }, LockService: { getScriptLock: () => ({ waitLock() {
  }, releaseLock() {
  } }) }, SpreadsheetApp: { openById(id) {
    opens++;
    assert.equal(id, "directory-copy");
    return raw.wb;
  }, flush() {
  }, newRichTextValue: () => ({ setText(text) {
    this.text = text;
    return this;
  }, build() {
    return this;
  } }) }, Utilities: { getUuid: () => crypto.randomUUID(), Charset: { UTF_8: "utf-8" }, DigestAlgorithm: { SHA_256: "sha256" }, computeDigest: (_, s) => [...crypto.createHash("sha256").update(s).digest()], computeHmacSha256Signature: (s, k) => [...crypto.createHmac("sha256", k).update(s).digest()] }, ContentService: { MimeType: { JSON: "json" }, createTextOutput(text) {
    return { text, setMimeType() {
      return this;
    } };
  } } };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return { ctx, raw, opens: () => opens };
}
const plain = (v) => JSON.parse(JSON.stringify(v));
test("package requires Google sign-in, omits anonymous access, source data and existing app mutations", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(output, "appsscript.json")));
  assert.equal(manifest.webapp.access, "ANYONE");
  assert.equal(manifest.exceptionLogging, "NONE");
  const html = fs.readFileSync(path.join(output, "Index.html"), "utf8");
  assert(html.includes("directory-source"));
  assert(!html.includes('src="/app.js"'));
  assert(!code.includes("TONKHO"));
});
test("compiled GAS rejects no Google identity and fake role payload before opening Sheets", () => {
  const f = runtime("");
  assert.equal(f.ctx.directoryUi({ action: "create", roles: ["director"], payload: {} }).error, "GOOGLE_IDENTITY_REQUIRED");
  assert.equal(f.opens(), 0);
  const g = runtime("unknown@example.test");
  assert.equal(g.ctx.directoryUi({ action: "search" }).error, "FORBIDDEN");
  assert.equal(g.opens(), 0);
});
test("compiled HTTP endpoint always requires HMAC; owner browser is not an API token", () => {
  const f = runtime();
  const r = f.ctx.doPost({ postData: { contents: JSON.stringify({ action: "create", actor_id: actors.finance.id, roles: ["director"], payload: { TEN: "Cannot write" } }) } });
  assert.equal(JSON.parse(r.text).error, "HMAC_REQUIRED");
  assert.equal(f.opens(), 0);
});
test("compiled GAS signed create, +84 normalization, replay and index search run through native Sheets driver", () => {
  const f = runtime(), base = { client_id: "fixture", actor_id: actors.finance.id, timestamp: Date.now(), action: "create", idempotency_key: "gas-create", payload: { customer: { TEN: "=Literal fixture", DIEN_THOAI: "+84 90 123 4567" } } }, send = (body) => {
    const envelope = { ...body, signature: crypto.createHmac("sha256", "private-fixture-hmac").update(stable(body)).digest("hex") };
    return JSON.parse(f.ctx.doPost({ postData: { contents: JSON.stringify(envelope) } }).text);
  };
  const a = send(base);
  assert.equal(a.ok, true);
  assert.equal(a.data.customer.MA_KHACH, "KTD-000001");
  assert.deepEqual(a.data.customer.DIEN_THOAI, ["0901234567"]);
  assert.equal(send({ ...base, timestamp: Date.now() + 1 }).data.replayed, true);
  assert.equal(f.raw.sheets.KHACH.rows[1][2], "=Literal fixture");
  const q = plain(f.ctx.directoryUi({ action: "search", payload: { q: "literal" } }));
  assert.equal(q.data.customers[0].TEN, "=Literal fixture");
});
test("compiled browser uses actual Google identity; sales forged field update blocked", () => {
  const f = runtime(actors.sales.id);
  const c = f.ctx.directoryUi({ action: "create", idempotency_key: "sales-create", payload: { customer: { TEN: "Sales fixture" } } });
  assert.equal(c.ok, true);
  const r = f.ctx.directoryUi({ action: "update", idempotency_key: "sales-edit", expected_version: 1, roles: ["director"], payload: { ma: c.data.customer.MA_KHACH, customer: { TEN: "Forged" } } });
  assert.equal(r.error, "FORBIDDEN");
});
test("source-copy configuration rejects originals before any source access, and setup rejects Dispatch project", () => {
  const f = runtime(actors.director.id);
  f.raw.properties.values.CD_CONFIRM_SOURCE_COPIES = "true";
  f.raw.properties.values.CD_SOURCE_COPIES_JSON = JSON.stringify({ SALE: f.ctx.DirectoryBundle.ORIGINAL_IDS[0], CARE: "copy-care", FIN: "copy-fin", DISPATCH: "copy-dispatch" });
  assert.throws(() => f.ctx.configureCustomerDirectorySources(), /COPY_SOURCE_REQUIRED/);
  assert.equal(f.opens(), 0);
  f.ctx.ScriptApp.getScriptId = () => "1k2pMSKKG1DF_r7p479O_VSZP3hOciVjCluZgoqM1pN7TOU0ArHeEgGZH";
  assert.throws(() => f.ctx.setupCustomerDirectory(), /SEPARATE_PROJECT_REQUIRED/);
});
process.on("exit", () => fs.rmSync(output, { recursive: true, force: true }));
