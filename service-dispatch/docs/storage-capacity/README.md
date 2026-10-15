# Storage capacity patch — 2026-10-15

Staging only. No setup/reset, source workbook change, permission change or business-data migration. Existing ERP_STATE/JOURNAL headers and checksums remain compatible.

## Operation and recovery

The existing ScriptLock encloses recovery, preflight, archival and deletion. Grid size grows with insertRowsAfter, bounded by maxRows=10,000 for active tabs. Retain 20 verified snapshots and matching journals (at most 21 transiently). Only COMMITTED journals below the retained revision boundary are copied to ERP_ARCHIVE. Verify the full copied after-image and checksum before deleting a complete source attempt with one deleteRows operation. Keep latest state, latest journal and all pending intents. Archive attempts retain their IDs; an interrupted copy without a marker is removed/retried; a complete copy is verified/reused. State pruning occurs only after archive success. Existing command receipts stay in latest state, so replay of archived commands remains idempotent. Fault after commit may return an error although command committed; retry the SAME key.

Archive is lazy-created; recovery does not depend on archive availability. Do not delete active tabs, reset properties, or restore an old state alone. Before rollback, copy the entire staging workbook and retain its marker/properties. Code rollback can read unchanged active format; archive is audit-only. A malformed checksum fails closed; never clear sheets to bypass it.

Sync screen (director/finance/warehouse) shows active/archive used rows and current serialized snapshot characters / 1,000,000, warning above 70%. Archive rows do not have the active-tab 10,000-row cap. Google workbook 10-million-cell quota still applies; its limit counts ALLOCATED grid cells, including unused columns/rows and archive. This patch does NOT remove the one-million-character snapshot cap. Monitor archive and export/rotate before workbook quota; no automatic deletion of archived audit.

## Required before pilot: normalized persistence

Still OPEN; this patch is not normalized storage. Introduce ORDERS, CUSTOMERS, MACHINES, PAYMENTS, DEPOSITS, MATERIAL_LINES, EVENTS, COMMAND_RECEIPTS plus durable counters and indexes. Maintain domain/API behavior. Journal changed-row before/after images with checksums, expected versions and PREPARED/COMMITTED visibility; recovery applies each row idempotently under the same writer lock. Readers must not expose a partial transaction. Preserve command receipts and monotonic counters across rotation. Backfill into separate COPY workbook, compare projections/reports/money/stock and replay results, then switch pointer under lock; retain original read-only for rollback. Test concurrent writes, partial row failures, recovery, duplicate commands and stale expected_version before pilot.

## Capacity estimate at 30 orders/day (assumptions, not measured production data)

Full-snapshot example: 4,000 serialized characters per order INCLUDING its events/receipts and 8 writes/order => snapshot grows ~120,000 chars/day, hits 1,000,000 in ~8 days, even with retention. Archived journals alone grow about 23,400 allocated cells × days² (240 writes/day × average 120,000×days/2 chars ÷16,000 chars/chunk ×26 default sheet columns); 10 million cells at ~21 days ignoring other tabs, grid over-allocation and chunk rounding. Snapshot cap arrives first. Actual size depends heavily on events, money and materials; measure current chars/retained orders before extrapolating. Do not present 21 days as a safe runtime.

Normalized example: 25 new rows/order across all tables at average 20 allocated columns, 30 orders/day => 15,000 cells/day; theoretical empty 10m workbook ~667 days (~22 months), planning at 50% budget ~333 days (~11 months). Journal/receipt retention, extra masters and allocated spare grids must fit that budget; annual/monthly archival and separate workbooks may be needed. Photos remain private Drive files, not base64 sheet cells. Validate with pilot data; freeze launch until normalized capacity/recovery is accepted.
