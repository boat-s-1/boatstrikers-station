# PR #298 — production cutover readiness (2026-11-17, read-only)

Status: HOLD. No production installation, Cron cutover, or PR merge authorized.

## Verified
- Four production-captured writer definitions execute through the atomic candidate in disposable PostgreSQL; replay and late failure rollback passed at d4dc55b4.
- Production writers: SECURITY DEFINER, owner postgres, search_path public, EXECUTE grants postgres and service_role only (read-only catalog).
- Production Cron jobid 1: boatstrikers-openapi-live-3m; schedule */3 23,0-14 * * *; command select public.bs_sync_openapi_today(); (read-only query).
- Production bs_race_events, bs_race_entries and bs_race_results have 9 non-internal triggers, all enabled (read-only catalog).
- The isolated four-writer test uses minimal tables, NOT the full nine production triggers or external alert delivery.

## Release blockers
1. Confirm the latest CI ACL assertion passes.
2. Test real writers with production-equivalent trigger graph, permissions and representative existing data.
3. Verify offline Cron payload parsing and 24-course completeness; synthetic fixtures do not prove live HTTP.
4. Investigate historical result-only rows with missing events/entries and plan a separate safe repair.
5. Review rollback and monitoring, then obtain explicit production-change approval.

No production DB, Cron, Vercel, paid branch or merge was changed.

## Confirmed legacy Cron bootstrap gap (read-only function definition)
- The deployed bs_sync_openapi_today() calls bs_apply_openapi_preview(), bs_apply_openapi_preview_events(), and bs_apply_openapi_results(), but does NOT call bs_apply_openapi_bootstrap().
- Read-only cross-table comparison for 2026-11-13 through 2026-11-16: 156, 168, 156, and 120 result rows respectively; every one of these 600 results lacks a corresponding bs_race_events row.
- This provides a concrete mechanism for result-only records, but historical attribution still requires logs and other ingestion-path checks.
- Do NOT backfill blindly or switch Cron before trigger fan-out, payload completeness, and safe rollback have been verified.


## Production sync log cross-check (read-only, 2026-11-17)
- For race dates Nov 13, 14, 15, 16: each had 310 successful live_all calls and zero partial calls by race_date. Max reported event payload counts were 156, 168, 156, 120 respectively, yet all corresponding race results lacked bs_race_events rows. Thus 'success' and event_rows indicate parsed/processed payload, NOT confirmed event insertion.
- Maximum entry payloads were 935, 1003, 935, 718 for those dates; these are exhibition/preview entry rows, not proof of a complete six-boat bootstrap.
- The legacy live function does not invoke bootstrap. This aligns with missing events and is a strong root-cause candidate; do not attribute every historical record solely to this path without cross-checking other writers.
- Release gate must check persisted race-event count and six valid bootstrap entries per race, not merely Cron success or nonzero payload counts.

## Persisted-table count spot check (2026-11-17 read-only)
- Nov 13: events 0 / entries 0 / results 156.
- Nov 14: events 0 / entries 0 / results 168.
- Nov 15: events 0 / entries 0 / results 156.
- Nov 16: events 0 / entries 0 / results 120.
- Nov 17 (intraday snapshot, incomplete day): events 0 / entries 0 / results 111.
- Current-day results count is time-dependent; do not treat 111 as final.
- Confirm six entries per race with an actual persisted join after any eventual cutover, and stop/rollback on a mismatch.

## 2026-11-17 subsequent validation
- Commit 9d56e632: both PR298 V3 offline contract and PostgreSQL fixture CI completed SUCCESS. The isolated fixture now includes persisted six-boat identity checking and silent trigger-discard rollback.
- Read-only production catalog rechecked all nine triggers. Of particular note, the exhibition-column INSERT trigger calls the Ichika evaluator for each current-day entry; a six-boat bootstrap can cause six evaluations per race. An isolated stub test confirms fan-out, but production evaluator latency/side effects remain unverified.
- Current-day read-only spot check (intraday): bs_race_events=0, bs_race_entries=0, bs_race_results=113. The 113 result count is not final.
- Added PR298-PRODUCTION-READONLY-READINESS.sql to compare persisted counts with sync logs; it is a diagnostic artifact, not a migration.
- Gate 1 (CI) is now satisfied. Gates 2-5 remain HOLD. No production writes.
