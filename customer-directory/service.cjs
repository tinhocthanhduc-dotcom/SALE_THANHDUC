"use strict";
const C = require("./core.cjs");
function handle(request, actor, repository, readSources) {
  C.access(actor);
  if (request.action === "bootstrap") return { actor: { id: actor.id, name: actor.name, roles: actor.roles }, ...repository.read("overview", {}, actor) };
  const writes = ["create", "update", "add_contact", "merge", "scan_import", "review_import", "finalize_import"];
  let command = request.action === "command" ? request.command : writes.includes(request.action) ? { type: request.action, payload: request.payload || {}, idempotency_key: request.idempotency_key, expected_version: request.expected_version } : null;
  if (request.action === "scan_copies") {
    C.access(actor, ["finance", "director"]);
    if (!readSources) C.fail("COPY_SOURCES_REQUIRED");
    command = { type: "scan_import", payload: { rows: readSources() }, expected_version: request.expected_version, idempotency_key: request.idempotency_key };
  }
  if (command) {
    if (command.type === "scan_import" && request.action !== "scan_copies" && !readSources?.synthetic) C.fail("USE_VERIFIED_COPY_SCAN");
    return repository.submit(command, actor);
  }
  return repository.read(request.action, request.payload || {}, actor);
}
function response(fn) {
  try {
    return { ok: true, data: fn() };
  } catch (e) {
    return { ok: false, error: typeof e.code === "string" ? e.code : /^[A-Z][A-Z_]{2,80}$/.test(e.message || "") ? e.message : "SERVER_ERROR", ...e.code && e.details ? { details: e.details } : {} };
  }
}
module.exports = { handle, response };
