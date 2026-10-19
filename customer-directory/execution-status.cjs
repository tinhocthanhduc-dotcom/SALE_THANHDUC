"use strict";
const fs = require("node:fs"), kind = process.argv[2];
let raw = {};
try {
  raw = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
} catch (e) {
}
function find(v2, depth = 0) {
  if (!v2 || typeof v2 !== "object" || depth > 5) return null;
  if (kind === "setup" && v2.configured === true || kind === "uat" && v2.pass === true && v2.root_untouched === true) return v2;
  for (const k of ["result", "response", "data"]) {
    const r = find(v2[k], depth + 1);
    if (r) return r;
  }
  return null;
}
const v = find(raw), report = { confirmed: !!v, kind, owner_run: kind === "setup" ? "setupCustomerDirectory" : "runCustomerDirectoryCopyUat", ...v ? { checks: v.checks, spreadsheet_url: v.spreadsheet_url, synthetic_only: v.synthetic_only, root_untouched: v.root_untouched } : { reason: "Execution API did not confirm completion. Owner can run the named function in the separate project editor." } };
fs.writeFileSync(process.argv[4], JSON.stringify(report, null, 2));
console.log(JSON.stringify({ kind, confirmed: !!v, owner_run_required: !v }));
