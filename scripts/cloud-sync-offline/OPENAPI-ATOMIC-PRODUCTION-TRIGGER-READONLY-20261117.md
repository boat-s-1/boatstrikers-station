# PR #298 — production trigger and RPC read-only compatibility check (2026-11-17)

Status: **HOLD — not a production rollout approval**.

Read-only catalog queries against Supabase project `rzosrbkyniyedolhkgxo` confirmed the four existing RPCs:
`bs_apply_openapi_bootstrap(jsonb,jsonb,timestamptz)`,
`bs_apply_openapi_preview(jsonb,timestamptz)`,
`bs_apply_openapi_preview_events(jsonb,timestamptz)`,
`bs_apply_openapi_results(jsonb,jsonb,timestamptz)`.
All four are SECURITY DEFINER, executable by `service_role`, and **not** executable by `anon` or `authenticated`. The new candidate remains SECURITY INVOKER, with EXECUTE restricted to `service_role`.

## Trigger inventory (actual production catalog)

| Table | Trigger | Event |
| --- | --- | --- |
| bs_race_entries | bs_race_entries_exhibition_guard | BEFORE INSERT/UPDATE |
| bs_race_entries | bs_race_entries_set_updated_at | BEFORE UPDATE |
| bs_race_entries | trg_bs_reconcile_bootstrap_entry | BEFORE UPDATE |
| bs_race_entries | trg_bs_reconcile_bootstrap_event_after_entry | AFTER UPDATE |
| bs_race_entries | trg_bs_track_entry_first_seen | AFTER INSERT/UPDATE |
| bs_race_entries | trg_ichika_escape_surge_on_exhibition_update | AFTER INSERT or UPDATE OF exhibition fields |
| bs_race_events | bs_race_events_set_updated_at | BEFORE UPDATE |
| bs_race_events | trg_settle_theory_recommendations | AFTER INSERT or UPDATE OF trifecta/payout |
| bs_race_results | trg_bs_track_result_first_seen | AFTER INSERT/UPDATE |

The atomic candidate invokes bootstrap before preview and results in one database transaction. Bootstrap's existing SQL uses `ON CONFLICT DO NOTHING` for events/entries. Existing preview RPCs update existing rows; results RPC upserts results and updates entries/events. This ordering is compatible in principle, **but the actual trigger side effects are not isolated-tested**.

## Blocking release gates

1. Recreate a representative *non-production* schema with all nine triggers and required dependent functions/tables; verify atomic rollback including side effects and no unintended alerts or notifications.
2. Confirm official schedule parity and source priority (BRDB/PC-KYOTEI) before enabling bootstrap, including incomplete/empty programs and canceled races.
3. Confirm whether the Ichika row-level trigger creates unacceptable fan-out or notification side effects for six entries per race; do not bypass or disable it in production without separate impact review.
4. Test the actual Next.js handler against a disposable PostgREST/Supabase instance; current CI validates the parser, route guards and PostgreSQL candidate independently.
5. Verify live Cron path. The current database Cron calls `bs_sync_openapi_today()`, which still does **not** invoke the new Next.js route or atomic candidate. The candidate route remains opt-in only and **does not fix Cron automatically**.
6. Verify historical Nov 13–16 result-only races separately; current-day-only atomic bootstrap intentionally does not backfill them.
7. Require explicit production change approval and rollback procedure. PR stays Draft/HOLD.

No production writes, Cron edits, Vercel changes, deployments, paid branch creation, or feature-flag changes were made during this read-only audit.
