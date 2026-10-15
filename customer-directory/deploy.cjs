"use strict";
const fs = require("node:fs"), { execFileSync } = require("node:child_process"), p = JSON.parse(fs.readFileSync(process.argv[2], "utf8")), raw = JSON.parse(fs.readFileSync(process.argv[3], "utf8")), out = process.argv[4];
const list = Array.isArray(raw) ? raw : raw.deployments || raw.result || [];
const found = Array.isArray(list) ? list.find((d) => d.deploymentConfig?.versionNumber && d.entryPoints?.some((e) => e.entryPointType === "WEB_APP")) : null;
const args = ["--json", "create-deployment", "--description", "Customer directory COPY steps 1 and 2"];
if (found) args.push("--deploymentId", found.deploymentId);
let result;
try {
  result = JSON.parse(execFileSync("clasp", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
} catch (e) {
  throw Error("DIRECTORY_DEPLOYMENT_UNCONFIRMED");
}
const deploymentId = result.deploymentId || found?.deploymentId;
if (!deploymentId) throw Error("DIRECTORY_DEPLOYMENT_UNCONFIRMED");
fs.writeFileSync(out, JSON.stringify({ script_id: p.script_id, deployment_id: deploymentId, version: result.versionNumber || null, web_app_url: "https://script.google.com/macros/s/" + deploymentId + "/exec", google_login_required: true, owner_setup_required: true, existing_apps_modified: false }, null, 2));
console.log("Separate customer directory deployed; owner setup still required.");
