# PR #298 — V3 permission and side-effect audit

## Read-only production findings

- Existing V2 functions `bs_race_data_quality_rows(date)`, `bs_race_data_completeness(date)`, and `bs_record_race_data_completeness(date)` are SECURITY DEFINER; `service_role` EXECUTE=true; anon/authenticated EXECUTE=false.
- `service_role` SELECT/INSERT/UPDATE privilege checks are true on `bs_race_data_quality_alerts`, `bs_live_source_sync_logs`, `bs_race_events`, `bs_race_entries`, `bs_race_results`.
- No user-defined noninternal triggers found on `bs_race_data_quality_alerts` or `bs_live_source_sync_logs`. This does not exclude external consumers of DB notifications or application-level polling.
- All three V3 candidate files now explicitly `REVOKE ALL ... FROM PUBLIC,anon,authenticated` and `GRANT EXECUTE ... TO service_role`. New candidates use SECURITY INVOKER, not SECURITY DEFINER.

## Still unverified

- Actual PostgreSQL compilation and privileges of installed V3 candidate functions.
- PostgreSQL role/table RLS interaction and sequence permissions for `service_role` during real alert inserts.
- UPSERT idempotency, first_detected_at, and resolution behavior in actual transactions.
- External consumers of `pg_notify('boatstrikers_data_quality_alert', ...)`.
- V2/V3 scheduling cutover and isolated database lifecycle.

## Release gate

Install all three SQL candidates in an isolated DB under one reviewed transaction; check function execution as service_role and denied access as anon/authenticated; test writes against disposable fixture data only; rollback test fixtures and disable candidate scheduler before any production change. Keep PR Draft/HOLD until evidence exists.
