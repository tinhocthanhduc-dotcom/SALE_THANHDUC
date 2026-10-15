"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path"), { execFileSync } = require("node:child_process");
test("deployment reuses existing web endpoint and writes only non-secret project metadata", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "directory-deploy-fixture-"));
  try {
    fs.writeFileSync(path.join(dir, "project.json"), JSON.stringify({ script_id: "new-directory" }));
    fs.writeFileSync(path.join(dir, "list.json"), JSON.stringify([{ deploymentId: "existing-directory-url", deploymentConfig: { versionNumber: 1 }, entryPoints: [{ entryPointType: "WEB_APP" }] }]));
    const log = path.join(dir, "args.json");
    fs.writeFileSync(path.join(dir, "clasp"), '#!/usr/bin/env node\nrequire("node:fs").writeFileSync(process.env.DEPLOY_ARG_LOG,JSON.stringify(process.argv.slice(2)));process.stdout.write(JSON.stringify({deploymentId:"existing-directory-url",versionNumber:2}));\n', { mode: 493 });
    execFileSync(process.execPath, [path.join(__dirname, "../deploy.cjs"), path.join(dir, "project.json"), path.join(dir, "list.json"), path.join(dir, "out.json")], { env: { ...process.env, PATH: dir + path.delimiter + process.env.PATH, DEPLOY_ARG_LOG: log } });
    const args = JSON.parse(fs.readFileSync(log)), out = JSON.parse(fs.readFileSync(path.join(dir, "out.json")));
    assert(args.includes("--deploymentId"));
    assert(args.includes("existing-directory-url"));
    assert.equal(out.version, 2);
    assert.equal(out.owner_setup_required, true);
    assert.equal(out.google_login_required, true);
    assert.equal(out.existing_apps_modified, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("execution status never treats error/empty output as successful Google setup or UAT", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "directory-status-fixture-"));
  try {
    const input = path.join(dir, "in.json"), out = path.join(dir, "out.json");
    fs.writeFileSync(input, JSON.stringify({ error: { message: "403" } }));
    execFileSync(process.execPath, [path.join(__dirname, "../execution-status.cjs"), "setup", input, out]);
    assert.equal(JSON.parse(fs.readFileSync(out)).confirmed, false);
    fs.writeFileSync(input, JSON.stringify({ response: { result: { pass: true, synthetic_only: true, root_untouched: true, checks: 12 } } }));
    execFileSync(process.execPath, [path.join(__dirname, "../execution-status.cjs"), "uat", input, out]);
    assert.equal(JSON.parse(fs.readFileSync(out)).confirmed, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
