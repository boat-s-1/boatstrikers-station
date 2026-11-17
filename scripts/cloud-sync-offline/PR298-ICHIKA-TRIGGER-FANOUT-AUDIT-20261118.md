# PR298 — Ichika trigger live-function fan-out audit (2026-11-18)

Status: **READ-ONLY VERIFIED, CUTOVER HOLD**. Inspected production `pg_proc`, `pg_trigger`, and `pg_indexes`. No function execution, provider fetch, database writes, or Cron change.

## Verified execution path

1. Existing `public.bs_apply_openapi_bootstrap(jsonb,jsonb,timestamptz)` inserts each six-boat entry with `INSERT INTO public.bs_race_entries ... ON CONFLICT (...) DO NOTHING`.
2. The production trigger `trg_ichika_escape_surge_on_exhibition_update` is enabled (`tgenabled='O'`), and is **FOR EACH ROW AFTER INSERT OR UPDATE OF official_exhibition_time, exhibition_time, official_lap, lap_time**.
3. Its function `trigger_evaluate_ichika_escape_surge_alerts()` invokes `public.evaluate_ichika_escape_surge_alerts()` when the inserted/updated row is for the current JST date.
4. That evaluation function scans **all current-day entries**, groups race readiness requiring six exhibition times and lap times, then inserts qualifying alerts into `public.bs_ichika_escape_surge_alerts` with `ON CONFLICT (race_date,course_code,race_no) DO NOTHING`.
5. A unique index on the alert race key is present, along with a date index and a pending-notification index.

## Implications and limits

- For a previously empty day, inserting **N distinct new entries** through bootstrap can cause up to **N calls to the global daily alert evaluation**, because the trigger fires on every inserted entry. For 100 races, N=600. This is a static upper-bound on invocations in that path, **not a measured production invocation count**.
- The unique alert key prevents duplicate alert rows for the same race, but does **not** prevent repeated whole-day scans, nor establish that downstream notifications are deduplicated.
- Bootstrap entries do not explicitly supply exhibition/lap values. The current evaluator requires six complete pairs; therefore a clean bootstrap alone is not expected to create qualifying alerts, but may still repeatedly scan. Existing same-day exhibition data and merge behavior require isolation tests.
- `ON CONFLICT DO NOTHING` reduces repeated insert effects but does not bound CPU, locks or timeouts. A large atomic transaction could suffer severe fan-out and rollback.
- **Do not disable the trigger in production** as an optimization without a separate functional review: that could suppress legitimate real-time alerts.

## Required tests before deployment

- Real trigger + real evaluator in a schema-equivalent isolated database, 1 race / 100 races / 288 races; measure calls, duration, DB work, and alert row count.
- Compare first bootstrap, identical replay, partial existing-day merge, exhibition updates, and forced rollback. Ensure all alert/telemetry/theory side effects roll back atomically.
- Evaluate a separately reviewed optimization that skips global evaluation on inserts with no relevant exhibition/lap values or defers one evaluation to after the batch, **without changing live alert behavior**. Any such change needs a new isolated test and explicit approval before production.

**Release gate remains HOLD until fan-out is bounded and measured.**
