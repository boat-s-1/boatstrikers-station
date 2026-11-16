# PR #298 — read-only production alert trigger function audit (2026-11-17)

**Scope:** Direct, read-only `pg_proc` and `pg_trigger` catalog queries against production Supabase project `rzosrbkyniyedolhkgxo`. No DML, DDL, trigger invocation, or changes to live data.

## Verified definitions

- `trg_ichika_escape_surge_on_exhibition_update`: `AFTER INSERT OR UPDATE OF official_exhibition_time, exhibition_time, official_lap, lap_time ON public.bs_race_entries FOR EACH ROW`, calling `trigger_evaluate_ichika_escape_surge_alerts()`.
- The trigger function calls `evaluate_ichika_escape_surge_alerts()` when `NEW.race_date` is today in `Asia/Tokyo`. **It has no guard checking whether NEW contains exhibition or lap metrics.**
- The evaluation function scans **all of today's** `bs_race_entries` and groups by race. `race_ready` requires exactly six rows with non-null exhibition time **and** lap time; qualifying boat 1 must match the best exhibition and lap times. The function inserts into `bs_ichika_escape_surge_alerts` with `ON CONFLICT (race_date,course_code,race_no) DO NOTHING`.
- Other entry triggers include `bs_race_entries_exhibition_guard` (BEFORE INSERT/UPDATE), `trg_bs_track_entry_first_seen` (AFTER INSERT/UPDATE), and reconciliation triggers on UPDATE.

## Consequences for current-day bootstrap

- Inserting 3,600 missing entry rows **could invoke the alert evaluation function up to 3,600 times**, assuming all rows insert and triggers are enabled. This is a function invocation upper-bound, **not** a claim of 3,600 alert inserts or notifications.
- For new rows without exhibition/lap metrics, that new race is not eligible for alert insertion yet. But every invocation still scans all of today's rows and can evaluate **other already-ready races**.
- `ON CONFLICT DO NOTHING` limits duplicate alert table rows by race; it does **not** prove no duplicate external notifications, or acceptable database load.
- Function definitions alone do not establish query duration, trigger timings, or downstream delivery behavior. No actual trigger load test was run.

## Candidate mitigation (design only; do not apply)

Investigate a **narrow guard on the trigger function** to avoid invoking the full-day alert evaluation when `NEW` lacks the required exhibition/lap pair, while preserving evaluation on relevant changes and existing alert behavior. Validate against both official and fallback metric columns, null transitions, current-day updates, and existing alert triggers. A guard may need to account for an update that removes or changes metrics and any downstream business rules. Never disable the alert trigger globally without an explicit impact assessment.

## Release gate

Keep `BS_OPENAPI_TODAY_SYNC_ENABLED` unset and PR Draft. Before activation, obtain explicit approval for isolated paid-branch resources if needed; measure invocation counts and timing for 6/600/3,600 entries, verify `bs_ichika_escape_surge_alerts` inserts and external notifications, and check immutable TRINITY snapshots. Do not apply a production trigger change without its own review, rollback and approval.
