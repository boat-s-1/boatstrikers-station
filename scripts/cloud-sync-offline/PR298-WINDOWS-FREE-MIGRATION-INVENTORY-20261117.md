# BoatStrikers Windows-free ingestion migration: verified inventory and safe gates

2026-11-17. User states Windows Task Scheduler previously fetched BRDB-API and PC-KYOTEI data and updated the site; Windows becomes progressively slow. Goal: eliminate routine Windows dependence, without breaching source provider restrictions.

## Verified by repository inspection
- `public.bs_sync_openapi_today()` runs in Supabase Cron, fetches `https://boatraceopenapi.github.io/api/v1/today.json` every 3 minutes during its JST window, and writes preview/results only. It **does not** insert baseline race/boat rows.
- `app/api/live/openapi-preview/route.js` contains a separately implemented **bootstrap** path for missing baseline rows and preview updates. Its HTTP handler requires `Authorization: Bearer <CRON_SECRET>`; both GET and POST call the same write handler. Current-day sync additionally requires `BS_OPENAPI_TODAY_SYNC_ENABLED=true`.
- The route's `BS_OPENAPI_ATOMIC_SYNC_ENABLED=true` path targets candidate `bs_apply_openapi_atomic_candidate`; the non-atomic fallback invokes bootstrap then preview RPCs as separate transactions.
- Route uses `cache: 'no-store'`; a request to the route can trigger an upstream fetch. It must not be used as a harmless health probe. No HTTP route was invoked in this investigation.
- Existing bootstrap code validates six program racers per race on current day; historical route path does not apply identical current-day checks.
- Source provenance prioritization in route: existing BRDB program rows over missing-row OpenAPI bootstrap; existing PC-KYOTEI exhibition values over OpenAPI fallback.
- No PC-KYOTEI or BRDB client executable/source was identified by exact name in GitHub repository path inventory or code search. **This does not establish absence**: Windows-only scripts/configuration may be external to this repository.
- Provider email (user screenshot) asks to revise BRDB SQL according to Q011 and stop high-volume 5-minute polling. It does not restrict unrelated OpenAPI by itself.

## Safety constraints
1. **Do not restart Windows scheduled tasks.** Do not move five-minute BRDB polling to GitHub Actions/Supabase/Vercel.
2. PC-KYOTEI: inspect its licensing, platform and export capabilities; do not assume a Windows-only client can be installed/run in serverless Linux or that redistribution is authorized.
3. Avoid introducing a second overlapping OpenAPI poller: the existing three-minute Supabase Cron already fetches the source. Consolidate, cache, deduplicate, and assess source terms before changing cadence.
4. Do not enable the current-day Vercel route or candidate atomic RPC until production-equivalent trigger fan-out, all-day schedule parity, rate limits and rollback tests pass.
5. Prevent site/AI prediction success status from being inferred from HTTP 200 or sync logs alone; require persisted six-boat baseline checks and result completeness separately.
6. Prefer a single centrally controlled cloud scheduler with monitoring and bounded retries, and keep source-specific provenance in database.

## Migration workstreams and acceptance
| Workstream | Current evidence | Gate |
| --- | --- | --- |
| BRDB | Windows task disabled after provider request | Confirm Q011 SQL and allowed cadence; preserve historical data; no high-frequency polling |
| PC-KYOTEI | User reports Windows fetch and website updates | Identify actual executable/task/config, export/rights and fields; evaluate authorized non-Windows alternative |
| OpenAPI | Supabase Cron live; bootstrap not invoked | Isolated atomic ingest and trigger validation, official race/boat parity, independent source terms |
| Website | Next.js/Vercel code exists | Read-only monitoring, auth, controlled cutover; do not make GET route trigger writes unintentionally |
| Operations | GitHub Actions fixture PASS in previous commit | Cloud health checks and clear STOP/rollback; explicit production approval |

## One user input needed eventually
An **offline** copy of Windows Task Scheduler task names / exported task XML or scripts for PC-KYOTEI (redact passwords, API tokens, cookies and personal data). No need to turn tasks on. This can establish exactly what must be replaced.

Status: **design and read-only audit only**. PR #298 remains Draft/HOLD. No production DB/Cron/Vercel mutation or external provider polling performed.
