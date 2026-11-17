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
