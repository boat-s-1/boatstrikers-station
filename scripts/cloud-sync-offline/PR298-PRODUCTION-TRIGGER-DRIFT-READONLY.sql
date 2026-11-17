-- PR298: READ-ONLY production trigger/constraint drift gate.
-- PASS means metadata matches the inspected baseline, NOT that bulk writes are safe.
WITH expected_trigger AS (
 SELECT c.oid AS relid,t.oid AS trigger_oid,t.tgenabled,t.tgtype,
  pg_get_triggerdef(t.oid) AS definition
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 LEFT JOIN pg_trigger t ON t.tgrelid=c.oid
   AND t.tgname='trg_ichika_escape_surge_on_exhibition_update' AND NOT t.tgisinternal
 WHERE n.nspname='public' AND c.relname='bs_race_entries'
), metadata AS (
 SELECT
  (SELECT count(*)=1 AND coalesce(bool_and(tgenabled='O'
    AND definition LIKE '%AFTER INSERT OR UPDATE OF%'
    AND definition LIKE '%FOR EACH ROW EXECUTE FUNCTION trigger_evaluate_ichika_escape_surge_alerts()%'),false)
   FROM expected_trigger) AS ichika_trigger_baseline,
  (SELECT count(*)=9 FROM pg_trigger t
   JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname IN ('bs_race_events','bs_race_entries','bs_race_results')
     AND NOT t.tgisinternal) AS nine_triggers_present,
  (SELECT count(*)=1 FROM pg_constraint con
   WHERE con.conrelid='public.bs_race_entries'::regclass
    AND con.conname='bs_race_entries_event_fk'
    AND con.contype='f'
    AND pg_get_constraintdef(con.oid) LIKE '%ON DELETE CASCADE%') AS entries_fk_baseline,
  (SELECT count(*)=3 FROM pg_class c
   WHERE c.oid IN ('public.bs_race_events'::regclass,'public.bs_race_entries'::regclass,
                   'public.bs_race_results'::regclass)
     AND c.relrowsecurity AND NOT c.relforcerowsecurity) AS three_tables_rls_enabled
)
SELECT ichika_trigger_baseline,nine_triggers_present,entries_fk_baseline,
 three_tables_rls_enabled,
 CASE WHEN ichika_trigger_baseline AND nine_triggers_present
  AND entries_fk_baseline AND three_tables_rls_enabled
  THEN 'METADATA BASELINE PASS ONLY: isolated bulk-trigger test required'
  ELSE 'HOLD: production trigger/constraint/RLS drift' END AS readiness
FROM metadata;
