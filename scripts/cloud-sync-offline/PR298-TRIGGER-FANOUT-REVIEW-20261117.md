# PR #298 — production trigger fan-out review (read-only, 2026-11-17)

Status: HOLD. This is a catalog inspection and a release decision aid, not a production change.

## Verified production behavior

- `trg_ichika_escape_surge_on_exhibition_update` is an AFTER INSERT OR UPDATE OF `official_exhibition_time, exhibition_time, official_lap, lap_time` row-level trigger on `public.bs_race_entries`.
- Its body calls `public.evaluate_ichika_escape_surge_alerts()` when the row's race date is today in JST.
- The evaluator scans **all today's** `bs_race_entries` rows, groups six-boat race readiness, ranks qualifying second boats, joins `bs_race_events`, and inserts into `bs_ichika_escape_surge_alerts` using ON CONFLICT DO NOTHING.
- Therefore, a bootstrap INSERT of six entries for each of R races can invoke the whole-day evaluator **6R times**, even if no exhibition data is present. This is a possible repeated full-day scan and should be benchmarked with production-equivalent volume. No wall-clock performance claim has been measured.
- The candidate's four-writer atomic transaction means downstream alert writes are part of the same database transaction; this is tested with a stub but **not yet** with the production evaluator and its actual schema.
- Existing isolated `openapi-atomic-trigger-fanout.test.sql` checks six INSERT evaluations, replay behavior, rollback, and retry with a stub evaluator. It does **not** benchmark the actual production evaluator.

## Other trigger side effects

- `bs_guard_exhibition_write` merges field values based on source priority and timestamp, and clears inherited exhibition data if the racer identity changes. This can modify the candidate's proposed row; persisted-row parity is essential.
- `bs_track_entry_first_seen` and `bs_track_result_first_seen` write `bs_source_first_seen`; those side effects must roll back on a failed atomic transaction.
- `trg_settle_theory_recommendations` on race events may update `bs_theory_recommendations` through a SECURITY DEFINER function when a trifecta is present.
- `bs_reconcile_bootstrap_entry` and `bs_reconcile_bootstrap_event_after_entry` may change `data_source` and `bootstrap_reconciled_at` during updates.

## Release requirements

1. Clone a representative **schema and trigger dependency graph**, with safe synthetic or sanitized data, into a disposable environment. Do not clone secrets or contact notification endpoints.
2. Benchmark initial 6-boat inserts and 3-minute replays with the real evaluator body, including race count, total function invocations, elapsed time, and query plans. Include 24-course/12R maximum where relevant.
3. Decide whether to replace row-level full-day evaluation with a separate once-per-batch evaluation, a statement-level mechanism, or an indexed/race-scoped approach. Verify no alert misses or duplicates.
4. Verify all side-effect tables roll back after a late failure, and that retry is idempotent.
5. Recheck privileges and the production Cron command. Explicit production-change approval remains mandatory.

Read-only index inventory: `bs_race_entries` has a date/course/race/boat btree index and multiple overlapping unique indexes; `bs_ichika_escape_surge_alerts` has a unique `(race_date,course_code,race_no)` index. These support lookups/conflict avoidance, but do not eliminate the 6R full-day evaluator invocations. No query-plan or latency measurement yet.

No production DDL, DML, Cron, Vercel, or merge action authorized.
