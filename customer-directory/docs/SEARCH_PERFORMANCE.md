# Search performance (COPY only)

Fixture: 201 synthetic customers, cold driver constructed per request. Counts include getRange, getLastRow, and getDataRange (one range acquisition; getDisplayValues is not counted separately).

| Results | 2444ef4 incl. constructor | Optimized incl. constructor |
| --- | ---: | ---: |
| 20 | 99 | 6 |
| 1 | 42 | 6 |

Old constructor accounted for 17 calls; excluding it gives the reported 82/25. New totals include metadata, journal fence before/after, full KHACH once and CHI_MUC once. All strings are searched on a Map, merged records resolved without further Sheets reads. History adds one LICH_SU read. Relevant table headers are validated using the same loaded ranges, rather than reading all tables' headers on every search. CD_META loads once per request; marker/identity/revision validation remains fail closed. No cross-request header or customer CacheService cache is necessary for this bound.

When journal is COMMITTED, no ScriptLock is acquired. A changed journal length invalidates the optimistic read. A pending transaction tries the write lock without waiting: if free, recover; if a writer holds it, replay checksum-verified COMMITTED deltas into an in-memory snapshot. This slow fallback may return the previous committed state, never partial data. The next search sees the new commit. This fallback reads the journal, so its count can exceed six; the six-call acceptance bound applies to stable reads. No unlocked write/recovery takes place.

Client: debounce 300ms, empty focus no request (ArrowDown explicitly permits browsing), bounded per-session cache 50 queries/30s, invalidate on local successful writes; loading status is aria-live and aria-busy. External changes can be up to 30s stale in browser cache. Late search responses cannot replace a newer query. Timing logs contain elapsed/count only, no query or customer payload.

## Google measurement

Google latency is not equivalent to Node timings. Workflow attempts `clasp run benchmarkCustomerDirectorySearch` after deploying the COPY. Artifact search-timing.json reports confirmed samples only if Google actually returned them. If Execution API is unavailable, run **benchmarkCustomerDirectorySearch** from the separate directory editor as owner: six read-only searches (three first-20, three single-code), logs only case, sample, elapsed_ms, result count, target 1500ms. Samples include driver construction/Sheets reads but exclude browser RPC transit and reading Script Properties. Browser console `directory.search` measures RPC round trip for uncached searches; no PII is logged.

A real before measurement of 2444ef4 was not captured by this agent. Do not label the fixture counts or Node timings as native Google latency, or claim the 1.5s target before actual samples. No production app or workbook writes are needed for benchmarking.
