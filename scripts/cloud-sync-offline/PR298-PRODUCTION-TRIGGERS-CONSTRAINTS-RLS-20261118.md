# PR298 — Production trigger, constraint and RLS inventory (2026-11-18)

**READ-ONLY AUDIT. Deployment remains HOLD.** Queried production PostgreSQL catalogs only; no provider fetch, DML, Cron change or branch creation.

## Table triggers (9)

| Table | Trigger | Timing / scope | Isolation test obligation |
|---|---|---|---|
| entries | `bs_race_entries_exhibition_guard` | BEFORE INSERT OR UPDATE | Verify exhibition merge/precedence and rejected writes |
| entries | `bs_race_entries_set_updated_at` | BEFORE UPDATE | Timestamp behavior on idempotent replay |
| entries | `trg_bs_reconcile_bootstrap_entry` | BEFORE UPDATE | BRDB reconciliation and source precedence |
| entries | `trg_bs_reconcile_bootstrap_event_after_entry` | AFTER UPDATE | Possible UPDATE to parent event; no partial reconciliation |
| entries | `trg_bs_track_entry_first_seen` | AFTER INSERT OR UPDATE | First-seen telemetry writes and rollback |
| entries | `trg_ichika_escape_surge_on_exhibition_update` | AFTER INSERT OR UPDATE OF four exhibition columns | **Potential fan-out:** invokes `evaluate_ichika_escape_surge_alerts()` for every current-JST-day triggered row; must test on 100+ races with real function and downstream tables |
| events | `bs_race_events_set_updated_at` | BEFORE UPDATE | Timestamp behavior |
| events | `trg_settle_theory_recommendations` | AFTER INSERT OR UPDATE OF trifecta/trifecta_payout | Can settle recommendations when trifecta is non-null; verify payout completeness and rollback |
| results | `trg_bs_track_result_first_seen` | AFTER INSERT OR UPDATE | First-seen telemetry and rollback |

The Ichika trigger is not restricted to updates alone: it includes INSERT. The trigger function checks current JST date and calls `public.evaluate_ichika_escape_surge_alerts()`. The real fan-out and side effects **have not been measured**; do not extrapolate from synthetic fixture stubs.

## Constraints

- `bs_race_entries`: FK `(race_date,course_code,race_no)` to events with `ON DELETE CASCADE`, UNIQUE `(race_date,course_code,race_no,boat_no)`, boat range 1–6, course 1–24, race 1–12, official exhibition course 1–6 or NULL, primary key `id`.
- `bs_race_events`: UNIQUE race key (two separately named UNIQUE constraints), course 1–24, race 1–12, race status limited to scheduled/exhibition/open/closed/finished/cancelled, primary key `id`.
- `bs_race_results`: UNIQUE race key, primary key `id`. No FK to events was reported in the inspected constraints. This allows result-only records to exist, consistent with the observed production gap.

## RLS

All three tables have RLS enabled and not forced. The catalog reports two similarly named public SELECT policies on each table; no write policy appeared in this query. This does not by itself establish effective permissions for SECURITY DEFINER writers. Verify ownership, GRANT/REVOKE, function execution context and RLS behavior in a production-like isolated database.

## Required isolation acceptance tests

1. Install candidate in a **separate** schema-equivalent disposable database, preserving all nine real triggers and referenced functions, not stubbed side effects.
2. Validate one-race and 100+ race full six-boat bootstrap, partial/empty/duplicate rejection, idempotent replay and concurrency.
3. Verify rollback leaves events, entries, results, first-seen telemetry, Ichika notifications and theory settlement unchanged after deliberate failure.
4. Record exact Ichika invocation count and side effects under bulk INSERT/UPDATE; impose bounded behavior before release if needed.
5. Confirm source-priority BRDB reconciliation and exhibition merge guard, RLS, service_role-only EXECUTE, and absence of anonymous write.
6. Verify expected official race coverage independently; no synthetic event from result-only records.

**No authorization for production function installation or Cron cutover is implied.**
