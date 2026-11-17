# 初音ニュース general 同期タイムアウトの原因候補 (2026-11-17)

## Evidence (production read-only aggregates)
Rolling 21 days, `hatsune_news_cron_runs.status='partial'`: 28 records. Every record has a timeout-related keyword in `details.general.errors`. The corresponding source-specific error arrays match `boatrace` timeout for 28/28, `nikkan` for 0/28, and `macour` for 0/28. Error strings themselves were not retrieved.

## Code audit (main branch, read-only)
- `app/api/cron/hatsune-news-pipeline/route.js` sequentially runs collection, media sync, general sync, fallback, and AI article generation; `maxDuration=60`.
- `lib/boatstrikersGeneralNewsSync.js` defines three list sources: `nikkan`, `macour`, `boatrace`. `FETCH_TIMEOUT_MS=3500` and `AbortSignal.timeout(FETCH_TIMEOUT_MS)` are used for HTML requests.
- Source list requests use `Promise.allSettled`; an individual failed source is recorded in `errors`, and the other source results can still be processed. The route counts these errors and records `partial`.
- A separate repair pass can fetch up to 8 existing articles; enrichment can fetch up to 16 candidates; network timeouts in these stages may be swallowed or represented differently.
- 35 `running` records with no completion remain a **separate unresolved issue**. No claim that the 3.5-second per-request timeout explains those records.

## Assessment
A repeated timeout in the official BOAT RACE list-source fetch is the leading explanation for the 28 `partial` records. It is **not** proven that the remote website is at fault: network path, response latency, and the configured 3.5-second budget have not been measured.

## Safe next steps
1. Add a pure offline classification helper for known source-specific failures and an operator-review status, without storing raw messages in UI.
2. Keep `boatrace` fetch failures non-fatal for other sources; avoid automatic retry or extending runtime without latency evidence.
3. Separately investigate 35 unfinished `running` records and confirm production user-facing news accessibility.
4. Any changes to production code, external requests, Cron or deployment require a separate reviewed approval.

No live provider requests, production writes, or automatic remediation.
