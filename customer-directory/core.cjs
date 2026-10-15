"use strict";
const allPhones = (c) => [.../* @__PURE__ */ new Set([...c.DIEN_THOAI || [], ...(c.NGUOI_LIEN_HE || []).flatMap((x) => x.dien_thoai || [])])];
const roles = ["sales", "reception", "dispatcher", "finance", "director"];
const stable = (x) => x === void 0 ? "null" : x === null || typeof x !== "object" ? JSON.stringify(x) : Array.isArray(x) ? "[" + x.map(stable).join(",") + "]" : "{" + Object.keys(x).sort().map((k) => JSON.stringify(k) + ":" + stable(x[k])).join(",") + "}";
const clone = (x) => JSON.parse(JSON.stringify(x));
function fail(code, details) {
  const e = new Error(code);
  e.code = code;
  e.details = details;
  throw e;
}
const fold = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/\s+/g, " ").trim();
function phones(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(/[;,/\n]/);
  return [...new Set(list.filter((x) => String(x).trim()).map((x) => {
    let v = String(x).trim();
    if (!/^[+\d ().-]+$/.test(v)) fail("INVALID_PHONE");
    v = v.replace(/[ ().-]/g, "").replace(/^\+84/, "0").replace(/^0084/, "0");
    if (/^[35789]\d{8}$/.test(v)) v = "0" + v;
    if (/^84\d{9}$/.test(v)) v = "0" + v.slice(2);
    if (!/^(0\d{9}|02\d{9})$/.test(v)) fail("INVALID_PHONE");
    return v;
  }))].sort();
}
function tax(value) {
  const v = String(value || "").replace(/[ .-]/g, "").trim();
  if (v && !/^(\d{10}|\d{13})$/.test(v)) fail("INVALID_TAX");
  return v;
}
function access(actor, allowed = roles) {
  if (!actor || actor.active === false || !actor.id || !actor.roles?.some((r) => allowed.includes(r))) fail("FORBIDDEN");
}
function initial() {
  return { customers: {}, reviews: {}, sources: {}, mappings: {}, history: [], revision: 0 };
}
function resolve(state, code) {
  const visited = /* @__PURE__ */ new Set();
  let c = state.customers[code];
  if (!c) fail("NOT_FOUND");
  while (c.TRANG_THAI === "DA_GOP") {
    if (visited.has(c.MA_KHACH)) fail("MERGE_CYCLE");
    visited.add(c.MA_KHACH);
    c = state.customers[c.GOP_VAO];
    if (!c) fail("MERGE_TARGET_MISSING");
  }
  return c;
}
function search(state, q) {
  const needle = fold(q), digits = String(q || "").replace(/[ ().-]/g, "").replace(/^\+84/, "0").replace(/^0084/, "0").replace(/\D/g, ""), numeric = digits && !/[a-z]/.test(needle), out = [], seen = /* @__PURE__ */ new Set();
  for (const c of Object.values(state.customers)) {
    if (!needle || fold([c.MA_KHACH, c.TEN, allPhones(c).join(" "), c.MST, c.MA_CU.join(" "), c.DIA_CHI].join(" ")).includes(needle) || numeric && (allPhones(c).some((p) => p.includes(digits)) || c.MST.includes(digits))) {
      const target = resolve(state, c.MA_KHACH);
      if (!seen.has(target.MA_KHACH)) {
        out.push(clone(target));
        seen.add(target.MA_KHACH);
      }
      if (out.length === 20) break;
    }
  }
  return out;
}
function get(state, code) {
  if (!state.customers[code]) {
    const alias = Object.values(state.customers).find((c) => c.MA_CU.includes(code));
    if (!alias) fail("NOT_FOUND");
    code = alias.MA_KHACH;
  }
  return clone(resolve(state, code));
}
function clean(input) {
  const out = {};
  for (const key of Object.keys(input)) {
    if (!["LOAI", "TEN", "MST", "DIEN_THOAI", "EMAIL", "DIA_CHI", "NGUOI_LIEN_HE", "CHO_PHEP_NO", "HAN_MUC_NO", "GHI_CHU", "TRANG_THAI"].includes(key)) fail("UNKNOWN_FIELD", { field: key });
    out[key] = input[key];
  }
  if ("DIEN_THOAI" in out) out.DIEN_THOAI = phones(out.DIEN_THOAI);
  if ("MST" in out) out.MST = tax(out.MST);
  for (const k of ["TEN", "EMAIL", "DIA_CHI", "GHI_CHU"]) if (k in out) {
    out[k] = String(out[k] || "").trim();
    if (out[k].length > 2e3) fail("FIELD_TOO_LONG");
  }
  if ("CHO_PHEP_NO" in out && typeof out.CHO_PHEP_NO !== "boolean") fail("INVALID_BOOLEAN");
  if ("HAN_MUC_NO" in out && (!Number.isSafeInteger(out.HAN_MUC_NO) || out.HAN_MUC_NO < 0)) fail("INVALID_LIMIT");
  if ("NGUOI_LIEN_HE" in out) {
    if (!Array.isArray(out.NGUOI_LIEN_HE) || out.NGUOI_LIEN_HE.length > 50) fail("INVALID_CONTACTS");
    out.NGUOI_LIEN_HE = out.NGUOI_LIEN_HE.map((c) => ({ ten: String(c.ten || "").trim().slice(0, 200), dien_thoai: phones(c.dien_thoai || []), ghi_chu: String(c.ghi_chu || "").trim().slice(0, 1e3) }));
  }
  return out;
}
function validate(c) {
  if (!["CA_NHAN", "CONG_TY"].includes(c.LOAI) || !c.TEN || !["DANG_DUNG", "NGUNG"].includes(c.TRANG_THAI)) fail("INVALID_CUSTOMER");
}
function conflicts(state, c, except = "", confirmation = {}) {
  const active = Object.values(state.customers).filter((x) => x.MA_KHACH !== except && resolve(state, x.MA_KHACH).MA_KHACH !== except), warnings = [];
  for (const x of active) {
    const owner = resolve(state, x.MA_KHACH);
    if (c.MST && x.MST === c.MST) fail("DUPLICATE_TAX", { existing: resolve(state, x.MA_KHACH) });
    const shared = allPhones(c).some((p) => allPhones(x).includes(p));
    if (shared && owner.LOAI === "CA_NHAN" && c.LOAI === "CA_NHAN") fail("DUPLICATE_PHONE", { existing: resolve(state, x.MA_KHACH) });
    if (shared && owner.LOAI === "CA_NHAN" && c.LOAI === "CONG_TY") {
      const linked = confirmation.mode === "CREATE_COMPANY_WITH_CONTACT" && confirmation.person_id === owner.MA_KHACH && confirmation.person_version === owner.VERSION && c.NGUOI_LIEN_HE.some(contact => contact.ten === owner.TEN && owner.DIEN_THOAI.every(phone => contact.dien_thoai.includes(phone)));
      const separate = confirmation.mode === "CREATE_SEPARATE" && String(confirmation.reason || "").trim();
      if (!linked && !separate) fail("PHONE_OF_PERSON", { existing: owner, choices: ["CONVERT_PERSON", "CREATE_COMPANY_WITH_CONTACT", "CREATE_SEPARATE"] });
      warnings.push({ code: linked ? "PERSON_LINKED_AS_CONTACT" : "PERSON_PHONE_SEPARATE", customer: owner.MA_KHACH });
    }
    if (shared && owner.LOAI === "CONG_TY") {
      if (confirmation.mode !== "CREATE_SEPARATE" || !String(confirmation.reason || "").trim()) fail("COMPANY_PHONE_WARNING", { existing: resolve(state, x.MA_KHACH), choices: ["ADD_CONTACT", "CREATE_SEPARATE"] });
      warnings.push({ code: "COMPANY_PHONE_SEPARATE", customer: x.MA_KHACH });
    }
    if (fold(c.TEN) === fold(x.TEN)) warnings.push({ code: "SIMILAR_NAME", customer: x.MA_KHACH });
  }
  return warnings;
}
function change(state, command, ctx) {
  access(ctx.actor);
  const s = clone(state), p = command.payload || {}, now = ctx.now(), actor = ctx.actor.id;
  let result = {}, events = [];
  const record = (action, before, after, reason = "") => {
    const event = { ID: ctx.id(), LOAI: action, MA_KHACH: after?.MA_KHACH || before?.MA_KHACH || "", TRUOC: before || null, SAU: after || null, AI: actor, LUC: now, LY_DO: reason };
    s.history.push(event);
    events.push(event);
  };
  if (command.type === "create") {
    const values = clean(p.customer || {});
    if ((values.CHO_PHEP_NO || values.HAN_MUC_NO) && !ctx.actor.roles.some((r) => ["finance", "director"].includes(r))) fail("FIELD_FORBIDDEN");
    const c = { LOAI: "CA_NHAN", TEN: "", MST: "", DIEN_THOAI: [], EMAIL: "", DIA_CHI: "", NGUOI_LIEN_HE: [], CHO_PHEP_NO: false, HAN_MUC_NO: 0, GHI_CHU: "", TRANG_THAI: "DANG_DUNG", ...values };
    if (p.confirmation?.mode === "CREATE_COMPANY_WITH_CONTACT") {
      const person = s.customers[p.confirmation.person_id];
      if (!person || person.LOAI !== "CA_NHAN" || person.TRANG_THAI === "DA_GOP" || c.LOAI !== "CONG_TY") fail("INVALID_CONTACT_SOURCE");
      if (p.confirmation.person_version !== person.VERSION) fail("VERSION_CONFLICT", { current: person.VERSION });
      if (!c.DIEN_THOAI.some(phone => allPhones(person).includes(phone))) fail("INVALID_CONTACT_SOURCE");
      c.NGUOI_LIEN_HE = clean({ NGUOI_LIEN_HE: [...c.NGUOI_LIEN_HE, { ten: person.TEN, dien_thoai: person.DIEN_THOAI, ghi_chu: "Liên hệ từ " + person.MA_KHACH }] }).NGUOI_LIEN_HE;
    }
    validate(c);
    const warnings = conflicts(s, c, "", p.confirmation);
    c.MA_KHACH = ctx.allocate();
    Object.assign(c, { GOP_VAO: "", MA_CU: [], VERSION: 1, TAO_LUC: now, TAO_BOI: actor, CAP_NHAT_LUC: now, CAP_NHAT_BOI: actor });
    s.customers[c.MA_KHACH] = c;
    record("TAO", null, c, p.confirmation?.reason);
    result = { customer: c, warnings };
  } else if (command.type === "update" || command.type === "add_contact") {
    const old = s.customers[p.ma];
    if (!old) fail("NOT_FOUND");
    if (old.TRANG_THAI === "DA_GOP") fail("CUSTOMER_MERGED", { target: old.GOP_VAO });
    if (command.expected_version !== old.VERSION) fail("VERSION_CONFLICT", { current: old.VERSION });
    let values;
    if (command.type === "add_contact") {
      if (old.LOAI !== "CONG_TY") fail("COMPANY_REQUIRED");
      values = clean({ NGUOI_LIEN_HE: [...old.NGUOI_LIEN_HE, p.contact] });
    } else values = clean(p.customer || {});
    if (Object.keys(values).some((k) => ["TEN", "MST", "LOAI", "CHO_PHEP_NO", "HAN_MUC_NO", "TRANG_THAI"].includes(k) && JSON.stringify(values[k]) !== JSON.stringify(old[k]))) access(ctx.actor, ["finance", "director"]);
    const next = { ...old, ...values, VERSION: old.VERSION + 1, CAP_NHAT_LUC: now, CAP_NHAT_BOI: actor };
    validate(next);
    const warnings = ["LOAI", "TEN", "MST", "DIEN_THOAI"].some((k) => JSON.stringify(next[k]) !== JSON.stringify(old[k])) ? conflicts(s, next, old.MA_KHACH, p.confirmation) : [];
    s.customers[p.ma] = next;
    record(command.type === "add_contact" ? "THEM_LIEN_HE" : "SUA", old, next, p.reason || p.confirmation?.reason);
    result = { customer: next, warnings };
  } else if (command.type === "merge") {
    access(ctx.actor, ["director"]);
    if (!String(p.reason || "").trim()) fail("REASON_REQUIRED");
    const a = s.customers[p.source], b = s.customers[p.target];
    if (!a || !b) fail("NOT_FOUND");
    if (a === b || a.TRANG_THAI === "DA_GOP" || b.TRANG_THAI === "DA_GOP") fail("INVALID_MERGE");
    if (command.expected_version !== a.VERSION || p.target_version !== b.VERSION) fail("VERSION_CONFLICT");
    const target = { ...b, NGUOI_LIEN_HE: [...b.NGUOI_LIEN_HE, ...a.NGUOI_LIEN_HE].filter((c, i, all) => all.findIndex((x) => JSON.stringify(x) === JSON.stringify(c)) === i), DIEN_THOAI: [.../* @__PURE__ */ new Set([...b.DIEN_THOAI, ...a.DIEN_THOAI])].sort(), MA_CU: [.../* @__PURE__ */ new Set([...b.MA_CU, ...a.MA_CU, a.MA_KHACH])].sort(), VERSION: b.VERSION + 1, CAP_NHAT_BOI: actor, CAP_NHAT_LUC: now };
    const source = { ...a, TRANG_THAI: "DA_GOP", GOP_VAO: b.MA_KHACH, VERSION: a.VERSION + 1, CAP_NHAT_BOI: actor, CAP_NHAT_LUC: now };
    s.customers[a.MA_KHACH] = source;
    s.customers[b.MA_KHACH] = target;
    for (const key of Object.keys(s.mappings)) if (s.mappings[key] === a.MA_KHACH) s.mappings[key] = b.MA_KHACH;
    record("GOP_NGUON", a, source, p.reason);
    record("GOP_DICH", b, target, p.reason);
    result = { customer: target };
  } else fail("UNKNOWN_COMMAND");
  s.revision++;
  return { state: s, result, events };
}
module.exports = { stable, initial, change, phones, tax, fold, search, get, resolve, clone, fail, access, clean };
