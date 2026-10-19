"use strict";
const C = require("./core.cjs");
const SOURCES = ["SALE", "CARE", "FIN", "DISPATCH"];
// Source-only recovery of zeros stripped by numeric spreadsheet cells.
function sourceText(value) {
  const raw = String(value ?? "");
  if (typeof value !== "number" || !Number.isFinite(value) || !/e/i.test(raw)) return raw;
  const [mantissa, exponent] = raw.toLowerCase().split("e"), sign = mantissa.startsWith("-") ? "-" : "", body = mantissa.replace(/^[+-]/, ""), at = (body.indexOf(".") < 0 ? body.length : body.indexOf(".")) + Number(exponent), digits = body.replace(".", "");
  return sign + (at <= 0 ? "0." + "0".repeat(-at) + digits : at >= digits.length ? digits + "0".repeat(at - digits.length) : digits.slice(0, at) + "." + digits.slice(at));
}
function importPhones(value) {
  const raw = Array.isArray(value) ? value.map(sourceText).join("; ") : sourceText(value);
  const valid = [], invalid = [], corrections = [];
  for (const part of raw.split(/[;,/\n]/).map(x => x.trim()).filter(Boolean)) {
    const padded = /^(?:[35789]\d{8}|2\d{9})$/.test(part) ? "0" + part : part;
    if (padded !== part) corrections.push({ goc: part, sau: padded });
    try { valid.push(...C.phones(padded)); }
    catch (err) { if (err.code !== "INVALID_PHONE") throw err; invalid.push(part); }
  }
  return { raw, valid: [...new Set(valid)].sort(), invalid, corrections };
}
function importTax(value) {
  const raw = sourceText(value), pure = raw.trim(), padded = /^(?:\d{9}|\d{12})$/.test(pure) ? "0" + pure : raw;
  const corrections = padded !== raw && padded !== pure ? [{ goc: raw, sau: padded }] : [];
  try { return { raw, valid: C.tax(padded), invalid: false, corrections, padded }; }
  catch (err) { if (err.code !== "INVALID_TAX") throw err; return { raw, valid: "", invalid: true, corrections, padded }; }
}
function normalize(row) {
  if (!SOURCES.includes(row.app) || !String(row.ma_cu || "").trim()) C.fail("SOURCE_ID_REQUIRED");
  if (/[;\r\n]/.test(String(row.ma_cu)) || String(row.ma_cu).length > 180) C.fail("SOURCE_ID_INVALID");
  const phone = importPhones(row.DIEN_THOAI_GOC ?? row.DIEN_THOAI), tax = importTax(row.MST_GOC ?? row.MST);
  const originalContacts = row.NGUOI_LIEN_HE_GOC ?? row.NGUOI_LIEN_HE ?? [];
  const contacts = originalContacts.map(c => ({ ...c, dien_thoai: importPhones(c.dien_thoai).valid }));
  const taxPhone = importPhones(tax.padded);
  const misplaced = phone.valid.includes(tax.valid) && !!tax.valid || taxPhone.valid.some(p => phone.valid.includes(p)) || /^02\d{9}$/.test(tax.padded.replace(/[ .-]/g, ""));
  const moved = misplaced ? taxPhone.valid : [];
  if (misplaced) { tax.invalid = true; tax.valid = ""; }
  const zeroAudit = [...phone.corrections.map(c => ({ truong: "DIEN_THOAI", ...c })), ...tax.corrections.map(c => ({ truong: "MST", ...c })), ...(misplaced ? taxPhone.corrections.map(c => ({ truong: "DIEN_THOAI_TU_MST", ...c })) : [])];
  const r = { ...row, app: row.app, ma_cu: String(row.ma_cu).trim(), TEN: String(row.TEN || "").trim(), MST: tax.valid, MST_GOC: tax.raw, MST_LOI: tax.invalid, MST_LOI_LY_DO: misplaced ? "MST_IS_PHONE" : tax.invalid ? "INVALID_TAX" : "", MST_CHUYEN_SDT: moved, BU_SO_0: zeroAudit, DIEN_THOAI: [...new Set([...phone.valid, ...moved])].sort(), DIEN_THOAI_GOC: phone.raw, DIEN_THOAI_LOI: phone.invalid, DIA_CHI: String(row.DIA_CHI || "").trim(), EMAIL: String(row.EMAIL || "").trim(), NGUOI_LIEN_HE: contacts, NGUOI_LIEN_HE_GOC: originalContacts, LOAI: row.LOAI === "CONG_TY" || tax.raw.trim() ? "CONG_TY" : "CA_NHAN", CHO_PHEP_NO: row.CHO_PHEP_NO === true || row.terms === "credit", HAN_MUC_NO: Number(row.HAN_MUC_NO || 0), open_debt: row.open_debt === true, updated_at: row.updated_at && Number.isFinite(Date.parse(row.updated_at)) ? new Date(row.updated_at).toISOString() : null };
  if (!Number.isSafeInteger(r.HAN_MUC_NO) || r.HAN_MUC_NO < 0) C.fail("SOURCE_AMOUNT_INVALID");
  if (!r.TEN) C.fail("SOURCE_NAME_REQUIRED");
  r.key = r.app + ":" + r.ma_cu;
  if (row.aliases !== void 0 && !Array.isArray(row.aliases)) C.fail("SOURCE_ALIAS_INVALID");
  r.aliases = [...new Set((row.aliases || []).map((x) => String(x).trim()).filter((x) => x && x !== r.ma_cu))];
  if (r.aliases.some((x) => /[;\r\n]/.test(x) || x.length > 180) || r.aliases.length > 50) C.fail("SOURCE_ALIAS_INVALID");
  return r;
}
function sameReviewEvidence(old, keys, byKey, fingerprint) {
  if (!old) return false;
  if (old.fingerprint === fingerprint) return true;
  const fields = ["app", "ma_cu", "key", "TEN", "LOAI", "MST", "MST_GOC", "DIEN_THOAI", "DIEN_THOAI_GOC", "EMAIL", "DIA_CHI", "NGUOI_LIEN_HE", "CHO_PHEP_NO", "HAN_MUC_NO", "open_debt", "updated_at", "aliases"];
  const evidence = rows => rows.map(r => Object.fromEntries(fields.map(k => [k, r[k]])));
  return Array.isArray(old.rows) && C.stable(old.rows.map(r => r.key)) === C.stable(keys) && C.stable(evidence(old.rows)) === C.stable(evidence(keys.map(k => byKey[k])));
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
    const fingerprint = hash(C.stable(keys.map((k) => byKey[k]))), old = oldReviews[id], same = sameReviewEvidence(old, keys, byKey, fingerprint);
    reviews[id] = { id, rows: keys.map((k) => byKey[k]), fingerprint, keys, left: a.keys, right: b.keys, open_debt: keys.some((k) => byKey[k].open_debt), VERSION: same ? old.VERSION : old ? old.VERSION + 1 : 1, decision: same ? old.decision : null, approved_by: same ? old.approved_by : null, approved_at: same ? old.approved_at : null, director_by: same ? old.director_by : null, director_at: same ? old.director_at : null, reason: same ? old.reason : "", changed_since_approval: !!old && !same };
  }
  for (const group of autoGroups) {
    if (group.keys.length < 2 || !group.keys.some((k) => byKey[k].open_debt)) continue;
    const keys = group.keys, id = "DT-AUTO-" + hash(keys.join("\n")).slice(0, 24), fingerprint = hash(C.stable(keys.map((k) => byKey[k]))), old = oldReviews[id], same = sameReviewEvidence(old, keys, byKey, fingerprint);
    reviews[id] = { id, kind: "AUTO_DEBT", rows: keys.map((k) => byKey[k]), fingerprint, keys, left: [keys[0]], right: keys.slice(1), open_debt: true, VERSION: same ? old.VERSION : old ? old.VERSION + 1 : 1, decision: same ? old.decision : null, approved_by: same ? old.approved_by : null, approved_at: same ? old.approved_at : null, director_by: same ? old.director_by : null, director_at: same ? old.director_at : null, reason: same ? old.reason : "", changed_since_approval: !!old && !same };
  }
  const report = { leading_zero_rows: records.filter(r => r.BU_SO_0.length).map(r => ({ app: r.app, ma_cu: r.ma_cu, changes: r.BU_SO_0 })), invalid_tax_rows: records.filter(r => r.MST_LOI).map(r => ({ app: r.app, ma_cu: r.ma_cu, raw: r.MST_GOC, reason: r.MST_LOI_LY_DO, moved_to_phone: r.MST_CHUYEN_SDT })), invalid_phone_rows: records.filter(r => r.DIEN_THOAI_LOI.length).map(r => ({ app: r.app, ma_cu: r.ma_cu, raw: r.DIEN_THOAI_GOC, invalid: r.DIEN_THOAI_LOI })), sources: Object.fromEntries(SOURCES.map((app) => [app, records.filter((r) => r.app === app).length])), source_rows: records.length, automatic_joins: automatic, automatic_groups: autoGroups.filter((g) => g.keys.length > 1).length, pending_review: Object.values(reviews).filter((r) => !r.decision || r.open_debt && !r.director_by).length, missing_phone_and_tax: records.filter((r) => !r.MST && !r.DIEN_THOAI.length).length, missing_phone: records.filter((r) => !r.DIEN_THOAI.length).length, unknown_updated_at: records.filter((r) => !r.updated_at).length };
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
    let repaired = 0;
    const mapped = new Map();
    for (const r of planned.records) {
      const code = s.mappings[r.key];
      if (!code) continue;
      const target = C.resolve(s, code).MA_KHACH;
      if (!mapped.has(target)) mapped.set(target, []);
      mapped.get(target).push(r);
    }
    for (const [code, rows] of mapped) {
      const old = s.customers[code], previous = rows.map(r => s.sources[r.key]).filter(Boolean);
      if (!previous.length) continue;
      const beforeImport = chosenCustomer(previous), afterImport = chosenCustomer(rows), next = C.clone(old);
      const manuallyEdited = field => s.history.some(e => e.MA_KHACH === code && e.LOAI === "SUA" && C.stable(e.TRUOC?.[field]) !== C.stable(e.SAU?.[field]));
      const unchangedRaw = (r, field) => s.sources[r.key] && sourceText(s.sources[r.key][field + "_GOC"] ?? s.sources[r.key][field]) === sourceText(r[field + "_GOC"]);
      const taxEvidence = rows.some(r => unchangedRaw(r, "MST") && (r.BU_SO_0.some(c => c.truong === "MST") || r.MST_LOI_LY_DO === "MST_IS_PHONE") && r.MST === afterImport.MST);
      const taxEquivalent = /^(?:\d{9}|\d{12})$/.test(old.MST) && "0" + old.MST === afterImport.MST;
      if ((taxEquivalent || taxEvidence && !manuallyEdited("MST") && old.MST === beforeImport.MST) && !Object.values(s.customers).some(c => c.MA_KHACH !== code && c.TRANG_THAI !== "DA_GOP" && afterImport.MST && c.MST === afterImport.MST)) next.MST = afterImport.MST;
      const recoveredPhones = old.DIEN_THOAI.map(v => /^(?:[35789]\d{8}|2\d{9})$/.test(v) && afterImport.DIEN_THOAI.includes("0" + v) ? "0" + v : v);
      const additions = rows.flatMap(r => [
        ...(unchangedRaw(r, "DIEN_THOAI") ? r.BU_SO_0.filter(c => c.truong === "DIEN_THOAI" && r.DIEN_THOAI.includes(c.sau) && !(s.sources[r.key].DIEN_THOAI || []).includes(c.sau)).map(c => c.sau) : []),
        ...(unchangedRaw(r, "MST") ? r.MST_CHUYEN_SDT : [])
      ]);
      next.DIEN_THOAI = [...new Set([...recoveredPhones, ...(!manuallyEdited("DIEN_THOAI") && C.stable(old.DIEN_THOAI) === C.stable(beforeImport.DIEN_THOAI) ? additions : [])])].sort();
      if (C.stable(next.MST) !== C.stable(old.MST) || C.stable(next.DIEN_THOAI) !== C.stable(old.DIEN_THOAI)) {
        next.VERSION++; next.CAP_NHAT_LUC = ctx.now(); next.CAP_NHAT_BOI = ctx.actor.id;
        s.customers[code] = next; repaired++;
        event("CHUAN_HOA_SO_0", old, next, "Đối chiếu giá trị gốc của bản sao; giữ nguyên mã KTD");
      }
    }
    s.sources = Object.fromEntries(planned.records.map((r) => [r.key, r]));
    s.reviews = planned.reviews;
    result = { report: planned.report, repaired_customers: repaired };
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
module.exports = { sourceText, normalize, plan, readyGroups, chosenCustomer, apply, SOURCES };
