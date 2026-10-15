"use strict";
const fs = require("node:fs");
let raw;
try { raw = JSON.parse(fs.readFileSync(process.argv[2], "utf8")); } catch (_) {}
function find(value, depth = 0) {
  if (!value || depth > 6) return null;
  if (Array.isArray(value) && value.length === 6 && value.every(s => ["first_twenty", "single_code"].includes(s.case) && Number.isFinite(s.elapsed_ms) && s.elapsed_ms >= 0 && Number.isInteger(s.results) && Number.isInteger(s.sample))) return value.map(s => ({ case: s.case, sample: s.sample, elapsed_ms: s.elapsed_ms, results: s.results }));
  if (typeof value === "object") for (const key of ["result", "response", "data"]) { const found = find(value[key], depth + 1); if (found) return found; }
  return null;
}
const samples = find(raw);
const report = { confirmed: !!samples, environment: "Google_COPY", target_ms: 1500, ...(samples ? { samples } : { reason: "Execution API did not return timing samples. Owner must run benchmarkCustomerDirectorySearch in the separate directory project." }) };
fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 2));
console.log(JSON.stringify({ google_search_timing_confirmed: !!samples }));
