# PR #298 — Production bootstrap trigger fan-out audit (read-only)

Date: 2026-11-17 JST. Production project: `rzosrbkyniyedolhkgxo`. Catalog inspected with SELECT only. No write RPCs, triggers, cron, deployment, or billing resources changed.

## Confirmed execution chain
1. `bs_apply_openapi_bootstrap(p_events,p_entries,p_synced_at)` inserts missing base rows into `bs_race_events` and `bs_race_entries` with `ON CONFLICT ... DO NOTHING`.
2. `bs_race_entries` has `trg_ichika_escape_surge_on_exhibition_update AFTER INSERT OR UPDATE OF official_exhibition_time, exhibition_time, official_lap, lap_time FOR EACH ROW`.
3. The trigger calls `trigger_evaluate_ichika_escape_surge_alerts()`, which calls `evaluate_ichika_escape_surge_alerts()` whenever `NEW.race_date` equals today's JST date.
4. Therefore inserting 600 *new* current-day entry rows may cause up to 600 invocations of the alert evaluation function, even when the bootstrap only supplies program fields and no exhibition metrics. This is **potential fan-out**, not a measured count of notifications.
5. `bs_race_entries` also has `bs_race_entries_exhibition_guard BEFORE INSERT OR UPDATE`, `trg_bs_track_entry_first_seen AFTER INSERT OR UPDATE`, and reconciliation triggers for UPDATE. `bs_race_events` has a theory-settlement trigger for INSERT or payout-field UPDATE. Trigger presence does not prove a notification was sent.

## Release blocker
Do not turn on a current-day full-field bootstrap in production until an isolated branch/database test measures:
- 1 race / 6 inserts and full-day batch trigger invocation counts
- `evaluate_ichika_escape_surge_alerts()` query cost, duplicate notifications/records, and external side effects
- Retry/idempotency and partial-failure behavior
- Existing confirmed result/first-seen invariants
- A reviewed mitigation (e.g. conditional trigger guard for actual exhibition changes, or a controlled batch evaluation), with trigger owner approval and rollback

Do **not** disable production triggers or silently bypass alert logic as a workaround. Trigger evaluation and downstream effects are distinct from guaranteed external delivery.

## Reproducible catalog queries
```sql
SELECT c.relname, t.tgname, pg_get_triggerdef(t.oid)
FROM pg_trigger t
JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public'
  AND c.relname IN ('bs_race_events','bs_race_entries','bs_race_results')
  AND NOT t.tgisinternal
ORDER BY c.relname,t.tgname;

SELECT p.proname, pg_get_functiondef(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('bs_apply_openapi_bootstrap',
                   'trigger_evaluate_ichika_escape_surge_alerts',
                   'bs_guard_exhibition_write',
                   'bs_track_entry_first_seen');
```

Status: **HOLD** until isolated trigger fan-out tests are executed. No claim of passing tests.
