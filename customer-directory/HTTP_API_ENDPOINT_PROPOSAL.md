# COPY: separate signed API endpoint — pending owner approval

## Evidence

2026-10-15: current UI deployment GET redirects to accounts.google.com and returns HTML. An unauthenticated POST returns HTTP 401 HTML before doPost/HMAC. Owner's Dispatch check reports DIRECTORY_UNAVAILABLE because transport collapses non-JSON/HTTP failures. Sending an Apps Script OAuth bearer to this Google-login web deployment was not verified during initial delivery and did not provide a working connection in owner's check. Existing secrets or actor mappings should not be recreated based on this error.

## Prepared change (NOT DEPLOYED)

Keep existing UI deployment and its Google sign-in access. Add a second deployment in the SAME customer-directory COPY Apps Script project, preserving one ScriptLock and writer/workbook/counter.

Build preview: `node customer-directory/build-api-gas.cjs /tmp/customer-directory-api-preview`.

Only this separate API package has manifest access ANYONE_ANONYMOUS, because server-to-server UrlFetch must reach doPost without a browser login session. This is public HTTP transport, NOT unauthenticated data access. Its compiled CD_API_ONLY_=true guard:

- GET returns HMAC_REQUIRED, serves no HTML/UI; Index.html is absent.
- Browser RPC directoryUi and all owner setup entrypoints reject API-only execution.
- POST verifies existing HMAC, timestamp, client/actor allowlist and active roles before opening Sheets.
- Only DIEUPHOI may use bootstrap/search/get/create/update; merge/import/scan/command and other clients are forbidden.
- Existing per-field permissions, expected_version, idempotency and audit actor remain in the original core/repository.
- No secret, actor or customer provisioning/reset. Secret stays in Script Properties.

The default build remains Google authenticated (ANYONE); current UI deployment ID must NEVER be used for API deployment. No deployment request file has changed for this preview.

## Deployment after explicit approval

1. Pin existing COPY script ID from project.copy.json; build separate API and standard UI packages with matching .clasp.json.
2. Push API-only package, create a NEW deployment/version without the UI deployment ID; record its new API URL/ID separately.
3. Restore standard UI source/manifest to project HEAD in finally. Existing UI immutable version/URL remains unchanged. API immutable deployment continues using its own API-only version.
4. Update Dispatch server target to approved API URL, retaining existing secret/actor mappings. Existing owner then runs check/enable; do not log credentials or read customer data for unauthenticated smoke.
5. Verify unsigned public POST gets JSON HMAC_REQUIRED; bad signature rejected without Sheets access. Verify owner signed connection and identity, then enable. Native signed verification remains pending owner credentials/configuration.

Rollback: stop/remove the additional API deployment and disable Dispatch directory connection; retain old UI deployment, all properties, customer state and existing KTD. No restoration of old workbook snapshots.

## Local validation

89/89 Directory Node tests, including separate package access isolation, no GET/UI/owner bypass, signed DIEUPHOI create/search with replay, bad signatures rejected before Sheets, forbidden merge/import/other clients. Package built for review only. Native API URL/access change not yet created.
