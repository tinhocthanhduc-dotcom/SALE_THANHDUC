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
      r.setNumberFormat = format => { (sheet.formats ||= []).push({args,format}); return r; };
      r.setRichTextValues = (rows) => r.setValues(rows.map((row) => row.map((v) => v.text)));
      return r;
    };
  }
  const ctx = { console: { log() {
    throw Error("No PII logs allowed");
  } }, PropertiesService: { getScriptProperties: () => raw.properties }, ScriptApp: { getScriptId: () => "directory-script" }, Session: { getActiveUser: () => ({ getEmail: () => active }), getEffectiveUser: () => ({ getEmail: () => actors.director.id }) }, LockService: { getScriptLock: () => ({ tryLock() { return true; }, waitLock() {
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

test("setup applies text format to identity/phone/tax/alias columns and repeated setup preserves existing records", () => {
  const f=runtime(actors.director.id), wb=f.raw.wb;
  f.raw.properties.values.CD_CREATED_WORKBOOK_ID="directory-copy";
  wb.getUrl=()=>"https://docs.google.com/spreadsheets/d/directory-copy/edit";
  wb.setSpreadsheetTimeZone=()=>{};wb.setActiveSheet=()=>{};
  f.ctx.SpreadsheetApp.ProtectionType={SHEET:"SHEET"};
  f.ctx.SpreadsheetApp.newDataValidation=()=>({requireValueInList(){return this},setAllowInvalid(){return this},build(){return {}}});
  for(const sh of Object.values(f.raw.sheets)){
    sh.setFrozenRows=()=>{};sh.getProtections=()=>[{}];const range=sh.getRange.bind(sh);
    sh.getRange=(...args)=>{const r=range(...args);r.setDataValidation=()=>r;return r;};
  }
  const first=f.ctx.directoryUi({action:"create",idempotency_key:"format-fixture",payload:{customer:{TEN:"Text fixture",DIEN_THOAI:"02837542072",MST:"0312345678"}}});
  assert.equal(first.ok,true);
  const before=JSON.stringify(f.raw.sheets.KHACH.rows),counter=f.raw.properties.values.CD_COUNTER;
  assert.equal(f.ctx.setupCustomerDirectory().configured,true);
  assert.equal(f.ctx.setupCustomerDirectory().configured,true);
  assert.equal(JSON.stringify(f.raw.sheets.KHACH.rows),before);assert.equal(f.raw.properties.values.CD_COUNTER,counter);
  for(const [name,columns] of Object.entries({KHACH:[1,4,5,11,12],CHI_MUC:[1,3,4,5],NGUON:[1,2,3,4],ANH_XA:[1,2,3,4]}))
    for(const col of columns) assert(f.raw.sheets[name].formats.some(r=>r.format==="@"&&r.args[1]===col&&r.args[2]===100000),name+" col "+col);
  assert.equal(f.raw.sheets.KHACH.rows[1][4],"02837542072");assert.equal(f.raw.sheets.KHACH.rows[1][3],"0312345678");
});

test("existing-copy text upgrade validates marker before formatting any target cells", () => {
  const f=runtime(actors.director.id);f.raw.properties.values.CD_MARKER="wrong-marker";
  assert.throws(()=>f.ctx.normalizeCustomerDirectorySourceNumbers(),/COPY_MARKER_MISMATCH/);
  assert.equal(Object.values(f.raw.sheets).reduce((n,s)=>n+(s.formats||[]).length,0),0);
});

test('owner provisions DIEUPHOI actors in bulk without customer writes or exposing/rotating secrets',()=>{
 const f=runtime(actors.director.id),p=f.raw.properties.values,before=JSON.stringify(f.raw.sheets.KHACH.rows);
 const rows=[{id:'admin',name:'Chủ Điều phối',roles:['director','dispatcher']},{id:'phongkt',name:'Phong KT',roles:['technician']}];p.CD_DISPATCH_USERS=JSON.stringify(rows);
 const result=f.ctx.configureDispatchDirectoryClient(),clients=JSON.parse(p.CD_CLIENTS),users=JSON.parse(p.CD_USERS),secret=clients.DIEUPHOI.secret;
 assert.equal(result.customer_writes,0);assert.deepEqual(JSON.parse(p.CD_DISPATCH_ACTOR_MAP),plain(result.dispatch_actor_map));assert.equal(result.dispatch_actor_map.phongkt.role,'dispatcher');assert.deepEqual(users['dieuphoi:admin'].roles,['director']);assert.deepEqual(users['dieuphoi:phongkt'].roles,['dispatcher']);assert(!JSON.stringify(result).includes(secret));assert.equal(p.CD_DISPATCH_USERS,undefined);assert.equal(JSON.stringify(f.raw.sheets.KHACH.rows),before);
 p.CD_DISPATCH_USERS=JSON.stringify(rows);f.ctx.configureDispatchDirectoryClient();assert.equal(JSON.parse(p.CD_CLIENTS).DIEUPHOI.secret,secret);
 p.CD_DISPATCH_USERS=JSON.stringify([{...rows[1],roles:['director']}]);assert.throws(()=>f.ctx.configureDispatchDirectoryClient(),/DIRECTORY_ROLE_REVIEW_REQUIRED/);assert.equal(p.CD_DISPATCH_USERS,undefined);
 const forbidden=runtime(actors.finance.id);assert.throws(()=>forbidden.ctx.configureDispatchDirectoryClient(),/OWNER_REQUIRED/);
});
