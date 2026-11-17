# Production trigger dependency preflight (read-only) — 2026-11-16

## Trigger functions by table
| Table | Trigger function |
|---|---|
| bs_race_entries | bs_guard_exhibition_write |
| bs_race_entries | bs_reconcile_bootstrap_entry |
| bs_race_entries | bs_reconcile_bootstrap_event_after_entry |
| bs_race_entries | bs_set_updated_at |
| bs_race_entries | bs_track_entry_first_seen |
| bs_race_entries | trigger_evaluate_ichika_escape_surge_alerts |
| bs_race_events | bs_set_updated_at |
| bs_race_events | bs_settle_theory_recommendations_from_event |
| bs_race_results | bs_track_result_first_seen |

All nine are public PL/pgSQL trigger functions. `bs_settle_theory_recommendations_from_event` is SECURITY DEFINER; the other seven unique trigger functions are SECURITY INVOKER. The separate `bs_apply_openapi_bootstrap` RPC is SECURITY DEFINER.

## Risk assessment
- `trigger_evaluate_ichika_escape_surge_alerts` may evaluate alerts. Inspect actual function body and dependent functions before running even a one-race test.
- `bs_settle_theory_recommendations_from_event` may affect recommendation state, and runs with definer privileges.
- Reconciliation triggers can affect entries/events beyond a naive insert count.
- Name-based risk assessment is preliminary; exact write effects must be traced from function definitions.

## Non-production validation requirements
1. Capture and compare definitions and security mode of all trigger functions.
2. Resolve any called functions and referenced relations.
3. Run fixture insert inside a dedicated isolated database only; snapshot counts of alerts, recommendations, audit rows and race rows before/after.
4. Confirm repeated bootstrap is idempotent, and no unauthorized side effects occur.
5. Do not disable triggers as a shortcut to claim production-equivalent behavior.
6. Production remains read-only pending a separate approval.

## Source query
```sql
SELECT t.relname AS table_name, p.proname AS trigger_function,
 n.nspname AS function_schema, count(*) AS trigger_count
FROM pg_trigger g
JOIN pg_class t ON t.oid=g.tgrelid
JOIN pg_namespace tn ON tn.oid=t.relnamespace
JOIN pg_proc p ON p.oid=g.tgfoid
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE tn.nspname='public'
  AND t.relname IN ('bs_race_events','bs_race_entries','bs_race_results')
  AND NOT g.tgisinternal
GROUP BY 1,2,3 ORDER BY 1,2;
```
