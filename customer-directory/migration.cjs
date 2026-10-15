"use strict";
const C = require("./core.cjs");
const SOURCES = ["SALE", "CARE", "FIN", "DISPATCH"];
// Legacy imports retain untrusted phone text for review; live CRUD stays strict.
function importPhones(value) {
  const raw = Array.isArray(value) ? value.map(String).join("; ") : String(value ?? "");
  const valid = [], invalid = [];
  for (const part of raw.split(/[;,/\n]/).map(x => x.trim()).filter(Boolean)) {
    try { valid.push(...C.phones(part)); }
    catch (err) { if (err.code !== "INVALID_PHONE") throw err; invalid.push(part); }
  }
  return { raw, valid: [...new Set(valid)].sort(), invalid };
}
function normalize(row) {
  if (!SOURCES.includes(row.app) || !String(row.ma_cu || "").trim()) C.fail("SOURCE_ID_REQUIRED");
  if (/[;\r\n]/.test(String(row.ma_cu)) || String(row.ma_cu).length > 180) C.fail("SOURCE_ID_INVALID");
  const phone = importPhones(row.DIEN_THOAI_GOC ?? row.DIEN_THOAI);
  const r = { ...row, app: row.app, ma_cu: String(row.ma_cu).trim(), TEN: String(row.TEN || "").trim(), MST: C.tax(row.MST), DIEN_THOAI: phone.valid, DIEN_THOAI_GOC: phone.raw, DIEN_THOAI_LOI: phone.invalid, DIA_CHI: String(row.DIA_CHI || "").trim(), EMAIL: String(row.EMAIL || "").trim(), NGUOI_LIEN_HE: row.NGUOI_LIEN_HE || [], LOAI: row.LOAI === "CONG_TY" || C.tax(row.MST) ? "CONG_TY" : "CA_NHAN", CHO_PHEP_NO: row.CHO_PHEP_NO === true || row.terms === "credit", HAN_MUC_NO: Number(row.HAN_MUC_NO || 0), open_debt: row.open_debt === true, updated_at: row.updated_at && Number.isFinite(Date.parse(row.updated_at)) ? new Date(row.updated_at).toISOString() : null };
  if (!Number.isSafeInteger(r.HAN_MUC_NO) || r.HAN_MUC_NO < 0) C.fail("SOURCE_AMOUNT_INVALID");
  if (!r.TEN) C.fail("SOURCE_NAME_REQUIRED");
  r.key = r.app + ":" + r.ma_cu;
  if (row.aliases !== void 0 && !Array.isArray(row.aliases)) C.fail("SOURCE_ALIAS_INVALID");
  r.aliases = [...new Set((row.aliases || []).map((x) => String(x).trim()).filter((x) => x && x !== r.ma_cu))];
  if (r.aliases.some((x) => /[;\r\n]/.test(x) || x.length > 180) || r.aliases.length > 50) C.fail("SOURCE_ALIAS_INVALID");
  return r;
}
const name = (r) => C.fold(r.TEN), phonesMatch = (a, b) => a.DIEN_THOAI.some((p) => b.DIEN_THOAI.includes(p));
function plan(rows, oldReviews = {}, hash) {
  const records = rows.map((row) => {
    try {
      return normalize(row);
    } catch (e) {
      if (e.code) e.details = { app: row.app, ma_cu: row.ma_cu };
      throw e;
    }
  }).sort((a, b) => a.key.localeCompare(b.key)), byKey = {};
  for (const r of records) {
    if (byKey[r.key]) C.fail("DUPLICATE_SOURCE_KEY");
    byKey[r.key] = r;
  }
  const identity = /* @__PURE__ */ new Map();
  for (const r of records) for (const alias of [r.ma_cu, ...r.aliases]) {
    const key = r.app + ":" + alias;
    if (identity.has(key) && identity.get(key) !== r.key) C.fail("AMBIGUOUS_SOURCE_ALIAS");
    identity.set(key, r.key);
  }
  const parent = records.map((_, i) => i), taxes = records.map((r) => new Set(r.MST ? [r.MST] : [])), root = (i) => {
    let x = i;
    while (parent[x] !== x) x = parent[x];
    while (parent[i] !== i) {
      const next = parent[i];
      parent[i] = x;
      i = next;
    }
    return x;
  }, join = (i, j) => {
    const a = root(i), b = root(j);
    if (a === b) return false;
    const next = /* @__PURE__ */ new Set([...taxes[a], ...taxes[b]]);
    if (next.size > 1) return false;
    parent[b] = a;
    taxes[a] = next;
    return true;
  };
  let automatic = 0;
  const buckets = /* @__PURE__ */ new Map();
  records.forEach((r, i) => {
    for (const key of [r.MST ? "T:" + r.MST : "", "N:" + name(r), ...r.DIEN_THOAI.map((p) => "P:" + p)]) if (key) {
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(i);
    }
  });
  const pairs = /* @__PURE__ */ new Map();
  for (const bucket of buckets.values()) for (let i = 0; i < bucket.length; i++) for (let j = i + 1; j < bucket.length; j++) {
    pairs.set(bucket[i] + ":" + bucket[j], [bucket[i], bucket[j]]);
    if (pairs.size > 3e4) C.fail("TOO_MANY_REVIEW_CANDIDATES");
  }
  for (const [i, j] of pairs.values()) if (records[i].MST && records[i].MST === records[j].MST && join(i, j)) automatic++;
  for (const [i, j] of pairs.values()) if (phonesMatch(records[i], records[j]) && name(records[i]) === name(records[j]) && join(i, j)) automatic++;
  const grouped = /* @__PURE__ */ new Map();
  records.forEach((r, i) => {
    const k = root(i);
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k).push(r.key);
  });
  const autoGroups = [...grouped].map(([key, keys]) => ({ root: key, keys: keys.sort() })), groupOf = /* @__PURE__ */ new Map();
  for (const g of autoGroups) for (const key of g.keys) groupOf.set(key, g);
  const reviews = {}, seen = /* @__PURE__ */ new Set();
  for (const [i, j] of pairs.values()) {
    const a = groupOf.get(records[i].key), b = groupOf.get(records[j].key);
    if (a === b) continue;
    const keys = [...a.keys, ...b.keys].sort(), id = "DT-" + hash(keys.join("\n")).slice(0, 24);
    if (seen.has(id)) continue;
    seen.add(id);
    const fingerprint = hash(C.stable(keys.map((k) => byKey[k]))), old = oldReviews[id], same = old?.fingerprint === fingerprint;
    reviews[id] = { id, rows: keys.map((k) => byKey[k]), fingerprint, keys, left: a.keys, right: b.keys, open_debt: keys.some((k) => byKey[k].open_debt), VERSION: same ? old.VERSION : old ? old.VERSION + 1 : 1, decision: same ? old.decision : null, approved_by: same ? old.approved_by : null, approved_at: same ? old.approved_at : null, director_by: same ? old.director_by : null, director_at: same ? old.director_at : null, reason: same ? old.reason : "", changed_since_approval: !!old && !same };
  }
  for (const group of autoGroups) {
    if (group.keys.length < 2 || !group.keys.some((k) => byKey[k].open_debt)) continue;
    const keys = group.keys, id = "DT-AUTO-" + hash(keys.join("\n")).slice(0, 24), fingerprint = hash(C.stable(keys.map((k) => byKey[k]))), old = oldReviews[id], same = old?.fingerprint === fingerprint;
    reviews[id] = { id, kind: "AUTO_DEBT", rows: keys.map((k) => byKey[k]), fingerprint, keys, left: [keys[0]], right: keys.slice(1), open_debt: true, VERSION: same ? old.VERSION : old ? old.VERSION + 1 : 1, decision: same ? old.decision : null, approved_by: same ? old.approved_by : null, approved_at: same ? old.approved_at : null, director_by: same ? old.director_by : null, director_at: same ? old.director_at : null, reason: same ? old.reason : "", changed_since_approval: !!old && !same };
  }
  const report = { invalid_phone_rows: records.filter(r => r.DIEN_THOAI_LOI.length).map(r => ({ app: r.app, ma_cu: r.ma_cu, raw: r.DIEN_THOAI_GOC, invalid: r.DIEN_THOAI_LOI })), sources: Object.fromEntries(SOURCES.map((app) => [app, records.filter((r) => r.app === app).length])), source_rows: records.length, automatic_joins: automatic, automatic_groups: autoGroups.filter((g) => g.keys.length > 1).length, pending_review: Object.values(reviews).filter((r) => !r.decision || r.open_debt && !r.director_by).length, missing_phone_and_tax: records.filter((r) => !r.MST && !r.DIEN_THOAI.length).length, missing_phone: records.filter((r) => !r.DIEN_THOAI.length).length, unknown_updated_at: records.filter((r) => !r.updated_at).length };
  return { records, autoGroups, reviews, report };
}
function decide(state, p, ctx) {
  C.access(ctx.actor, p.director ? ["director"] : ["finance"]);
  const r = state.reviews[p.id];
  if (!r) C.fail("REVIEW_NOT_FOUND");
  if (p.expected_version !== r.VERSION) C.fail("VERSION_CONFLICT");
  if (!String(p.reason || "").trim()) C.fail("REASON_REQUIRED");
  const next = { ...r, VERSION: r.VERSION + 1 };
  if (p.director) {
    if (!r.decision || !r.open_debt) C.fail("ACCOUNTING_APPROVAL_REQUIRED");
    if (r.approved_by === ctx.actor.id) C.fail("SECOND_APPROVER_REQUIRED");
    next.director_by = ctx.actor.id;
    next.director_at = ctx.now();
  } else {
    if (r.kind === "AUTO_DEBT" && p.decision === "KHAC_KHACH") C.fail("AUTO_MATCH_SOURCE_REVIEW_REQUIRED");
    if (!["CUNG_KHACH", "KHAC_KHACH"].includes(p.decision)) C.fail("INVALID_DECISION");
    Object.assign(next, { decision: p.decision, approved_by: ctx.actor.id, approved_at: ctx.now(), director_by: null, director_at: null, reason: p.reason });
  }
  return next;
}
function readyGroups(state, hash) {
  const current = plan(Object.values(state.sources), state.reviews, hash), parent = {};
  for (const g of current.autoGroups) for (const key of g.keys) parent[key] = g.keys[0];
  const root = (k) => {
    while (parent[k] !== k) k = parent[k];
    return k;
  };
  const all = Object.values(current.reviews);
  for (const r of all) if (r.decision === "CUNG_KHACH" && (!r.open_debt || r.director_by)) {
    const a = root(r.left[0]), b = root(r.right[0]);
    parent[b] = a;
  }
  for (const r of all) if (r.decision === "KHAC_KHACH" && root(r.left[0]) === root(r.right[0])) C.fail("CONTRADICTORY_DECISIONS");
  const groups = {};
  for (const key of Object.keys(parent)) {
    const id = root(key);
    (groups[id] || (groups[id] = [])).push(key);
  }
  return Object.values(groups).map((keys) => ({ keys: keys.sort(), blocked: all.some((r) => r.keys.some((k) => keys.includes(k)) && (!r.decision || r.open_debt && !r.director_by)) }));
}
function chosenCustomer(rows) {
  const rank = { SALE: 1, CARE: 2, DISPATCH: 3, FIN: 0 }, newest = [...rows].sort((a, b) => Date.parse(b.updated_at || "1970-01-01") - Date.parse(a.updated_at || "1970-01-01") || rank[b.app] - rank[a.app] || a.key.localeCompare(b.key));
  const sales = rows.filter((r) => r.app === "SALE").sort((a, b) => Date.parse(b.updated_at || "1970-01-01") - Date.parse(a.updated_at || "1970-01-01")), invoice = sales[0] || newest[0], finance = rows.filter((r) => r.app === "FIN").sort((a, b) => Date.parse(b.updated_at || "1970-01-01") - Date.parse(a.updated_at || "1970-01-01") || a.key.localeCompare(b.key)), fin = finance[0];
  return { LOAI: rows.some((r) => r.LOAI === "CONG_TY") ? "CONG_TY" : "CA_NHAN", TEN: invoice.TEN, MST: sales.find((r) => r.MST)?.MST || newest.find((r) => r.MST)?.MST || "", DIEN_THOAI: [...newest.find((r) => r.DIEN_THOAI.length)?.DIEN_THOAI || []], DIA_CHI: newest.find((r) => r.DIA_CHI)?.DIA_CHI || "", EMAIL: newest.find((r) => r.EMAIL)?.EMAIL || "", NGUOI_LIEN_HE: newest.flatMap((r) => r.NGUOI_LIEN_HE || []), CHO_PHEP_NO: fin ? !!(fin.CHO_PHEP_NO || fin.HAN_MUC_NO > 0) : rows.some((r) => r.app === "DISPATCH" && r.CHO_PHEP_NO), HAN_MUC_NO: fin ? fin.HAN_MUC_NO : 0, GHI_CHU: "Nhập bản sao; nguồn được giữ tại NGUON.", TRANG_THAI: "DANG_DUNG" };
}
function apply(state, command, ctx, hash) {
  C.access(ctx.actor, ["finance", "director"]);
  const s = C.clone(state), p = command.payload || {}, events = [];
  const event = (action, before, after, reason = "") => {
    const e = { ID: ctx.id(), LOAI: action, MA_KHACH: after?.MA_KHACH || "", TRUOC: before || null, SAU: after || null, AI: ctx.actor.id, LUC: ctx.now(), LY_DO: reason };
    s.history.push(e);
    events.push(e);
  };
  let result;
  if (command.type === "scan_import") {
    if (command.expected_version !== s.revision) C.fail("VERSION_CONFLICT");
    const planned = plan(p.rows, s.reviews, hash);
    const plannedKeys = new Set(planned.records.flatMap((r) => [r.key, ...r.aliases.map((a) => r.app + ":" + a)]));
    for (const key of Object.keys(s.mappings)) if (s.sources[key] && !plannedKeys.has(key)) C.fail("MAPPED_SOURCE_REMOVED");
    s.sources = Object.fromEntries(planned.records.map((r) => [r.key, r]));
    s.reviews = planned.reviews;
    result = { report: planned.report };
    event("QUET_BAN_SAO", null, { report: planned.report });
  } else if (command.type === "review_import") {
    const old = s.reviews[p.id], next = decide(s, { ...p, expected_version: command.expected_version }, ctx);
    s.reviews[p.id] = next;
    event(p.director ? "GD_XAC_NHAN" : "KT_DUYET_TRUNG", old, next, p.reason);
    result = { review: next };
  } else if (command.type === "finalize_import") {
    C.access(ctx.actor, ["finance"]);
    if (command.expected_version !== s.revision) C.fail("VERSION_CONFLICT");
    let allocated = 0, unchanged = 0, pending = 0, remaining = 0;
    const limit = p.limit === void 0 ? 50 : Number(p.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) C.fail("INVALID_LIMIT");
    for (const group of readyGroups(s, hash)) {
      if (group.blocked) {
        pending++;
        continue;
      }
      const aliasKeys = group.keys.flatMap((k) => [k, ...s.sources[k].aliases.map((a) => s.sources[k].app + ":" + a)]), existing = [...new Set(aliasKeys.map((k) => s.mappings[k]).filter(Boolean).map((k) => C.resolve(s, k).MA_KHACH))];
      if (existing.length > 1) C.fail("EXISTING_GROUPS_NEED_DIRECTOR_MERGE", { codes: existing });
      if (!existing.length && allocated >= limit) {
        remaining++;
        continue;
      }
      const draft = existing.length ? null : chosenCustomer(group.keys.map((k) => s.sources[k]));
      if (draft) {
        const imported = new Set(Object.values(s.mappings)), collision = Object.values(s.customers).filter((c) => draft.MST && c.MST === draft.MST || !imported.has(c.MA_KHACH) && draft.LOAI === "CA_NHAN" && c.LOAI === "CA_NHAN" && draft.DIEN_THOAI.some((p2) => c.DIEN_THOAI.includes(p2)));
        if (collision.length) C.fail("MASTER_CUSTOMER_CONFLICT", { codes: collision.map((c) => c.MA_KHACH) });
      }
      const code = existing[0] || ctx.allocate();
      if (existing.length) {
        unchanged++;
      } else {
        const c = { ...draft, MA_KHACH: code, GOP_VAO: "", MA_CU: aliasKeys.sort(), VERSION: 1, TAO_LUC: ctx.now(), TAO_BOI: ctx.actor.id, CAP_NHAT_LUC: ctx.now(), CAP_NHAT_BOI: ctx.actor.id };
        s.customers[code] = c;
        event("NHAP_KHACH", null, c);
        allocated++;
      }
      const old = s.customers[code], aliases = [.../* @__PURE__ */ new Set([...old.MA_CU, ...aliasKeys])].sort();
      if (JSON.stringify(aliases) !== JSON.stringify(old.MA_CU)) {
        const c = { ...old, MA_CU: aliases, VERSION: old.VERSION + 1, CAP_NHAT_LUC: ctx.now(), CAP_NHAT_BOI: ctx.actor.id };
        s.customers[code] = c;
        event("THEM_MA_CU", old, c);
      }
      for (const key of aliasKeys) s.mappings[key] = code;
    }
    result = { allocated, unchanged, pending, remaining, mapping_count: Object.keys(s.mappings).length };
  } else C.fail("UNKNOWN_COMMAND");
  s.revision++;
  return { state: s, result, events };
}
module.exports = { normalize, plan, readyGroups, chosenCustomer, apply, SOURCES };
