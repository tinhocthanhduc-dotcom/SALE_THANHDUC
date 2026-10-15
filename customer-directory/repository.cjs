"use strict";
const C = require("./core.cjs"), M = require("./migration.cjs");
const stable = C.stable;
function delta(before, after) {
  const changed = {};
  for (const field of ["customers", "reviews", "sources", "mappings"]) {
    changed[field] = {};
    for (const [key, value] of Object.entries(after[field])) if (stable(before[field][key]) !== stable(value)) changed[field][key] = value;
    changed[field + "_removed"] = Object.keys(before[field]).filter((k) => !(k in after[field]));
  }
  changed.history = after.history.slice(before.history.length);
  changed.revision = after.revision;
  return changed;
}
function materialize(state, d) {
  const s = C.clone(state);
  for (const field of ["customers", "reviews", "sources", "mappings"]) {
    for (const key of d[field + "_removed"] || []) delete s[field][key];
    Object.assign(s[field], d[field]);
  }
  for (const e of d.history) if (!s.history.some((x) => x.ID === e.ID)) s.history.push(e);
  s.revision = d.revision;
  return s;
}
class Repository {
  constructor(driver, { hash, now = () => (/* @__PURE__ */ new Date()).toISOString(), id } = {}) {
    Object.assign(this, { driver, hash, now, id });
  }
  submit(command, actor) {
    C.access(actor);
    if (!command || typeof command.idempotency_key !== "string" || !command.idempotency_key.trim() || command.idempotency_key.length > 180) C.fail("IDEMPOTENCY_REQUIRED");
    if (command.expected_version !== void 0 && (!Number.isSafeInteger(command.expected_version) || command.expected_version < 0)) C.fail("INVALID_VERSION");
    const requestHash = this.hash(stable({ command, actor: actor.id }));
    return this.driver.lock(() => {
      this.driver.recover();
      const old = this.driver.receipt(command.idempotency_key);
      if (old) {
        if (old.hash !== requestHash) C.fail("IDEMPOTENCY_CONFLICT");
        return { ...C.clone(old.result), replayed: true };
      }
      const state = this.driver.read(), ctx = { actor, now: this.now, id: this.id, allocate: () => this.driver.allocate() }, out = ["scan_import", "review_import", "finalize_import"].includes(command.type) ? M.apply(state, command, ctx, this.hash) : C.change(state, command, ctx), result = { ...out.result, revision: out.state.revision }, transaction = { id: this.id(), key: command.idempotency_key, hash: requestHash, base_revision: state.revision, delta: delta(state, out.state), result };
      this.driver.prepare(transaction);
      this.driver.apply(transaction);
      this.driver.commit(transaction);
      return C.clone(result);
    });
  }
  read(action, payload, actor) {
    C.access(actor);
    if (["import_view", "review_detail", "mappings", "report"].includes(action)) C.access(actor, ["finance", "director"]);
    return this.driver.lock(() => {
      this.driver.recover();
      if (this.driver.query) return this.driver.query(action, payload);
      const s = this.driver.read();
      return query(s, action, payload, this.hash);
    });
  }
}
function query(s, action, p = {}, hash) {
  if (action === "search") return { customers: C.search(s, p.q || "") };
  if (action === "get") return { customer: C.get(s, p.ma) };
  if (action === "history") {
    const c = C.get(s, p.ma);
    return { events: s.history.filter((e) => [c.MA_KHACH, p.ma, ...c.MA_CU.filter((k) => /^KTD-\d{6}$/.test(k))].includes(e.MA_KHACH)).slice(-100).reverse() };
  }
  if (action === "overview") return { revision: s.revision, customers: Object.keys(s.customers).length };
  if (action === "report") return M.plan(Object.values(s.sources), s.reviews, hash).report;
  if (action === "mappings") return { rows: Object.entries(s.mappings).map(([key, code]) => {
    const i = key.indexOf(":");
    return { app: key.slice(0, i), ma_cu: key.slice(i + 1), MA_KHACH: C.resolve(s, code).MA_KHACH };
  }) };
  if (action === "import_view") return { revision: s.revision, reviews: Object.values(s.reviews).sort((a, b) => Number(b.open_debt) - Number(a.open_debt) || a.id.localeCompare(b.id)).map(({ id, VERSION, decision, open_debt, approved_by, director_by, keys, changed_since_approval }) => ({ id, VERSION, decision, open_debt, approved_by, director_by, count: keys.length, changed_since_approval })) };
  if (action === "review_detail") {
    const r = s.reviews[p.id];
    if (!r) C.fail("REVIEW_NOT_FOUND");
    return { review: r, rows: r.keys.map((k) => s.sources[k]) };
  }
  C.fail("UNKNOWN_ACTION");
}
class MemoryDriver {
  constructor({ fault = () => {
  } } = {}) {
    this.state = C.initial();
    this.counter = 0;
    this.journal = [];
    this.receipts = {};
    this.fault = fault;
    this.locked = false;
  }
  lock(fn) {
    if (this.locked) C.fail("LOCK_BUSY");
    this.locked = true;
    try {
      return fn();
    } finally {
      this.locked = false;
    }
  }
  read() {
    return C.clone(this.state);
  }
  allocate() {
    if (!this.locked) C.fail("LOCK_REQUIRED");
    if (this.counter >= 999999) C.fail("COUNTER_EXHAUSTED");
    return "KTD-" + String(++this.counter).padStart(6, "0");
  }
  receipt(k) {
    return this.receipts[k];
  }
  prepare(t) {
    this.journal.push({ transaction: C.clone(t), committed: false });
    this.fault("prepared");
  }
  apply(t) {
    this.state = materialize(this.state, t.delta);
    this.fault("applied");
  }
  commit(t) {
    this.receipts[t.key] = { hash: t.hash, result: C.clone(t.result) };
    this.journal.find((j) => j.transaction.id === t.id).committed = true;
    this.fault("committed");
  }
  recover() {
    for (const j of this.journal) if (!j.committed) {
      const t = j.transaction;
      if (this.state.revision !== t.base_revision && this.state.revision !== t.delta.revision) C.fail("RECOVERY_CONFLICT");
      if (this.state.revision === t.base_revision) this.state = materialize(this.state, t.delta);
      this.commit(t);
    }
  }
}
module.exports = { Repository, MemoryDriver, stable, delta, materialize, query };
