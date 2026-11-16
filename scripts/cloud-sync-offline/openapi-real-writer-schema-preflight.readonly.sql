-- PR #298: production READ-ONLY catalog preflight for actual writer integration.
-- SELECT only. No writer invocation, DDL, Cron, or trigger mutation.
-- Return blockers as rows; empty result means catalog contracts match known expectations.
WITH expected_functions(name, expected_args, expected_definer) AS (
 VALUES
 ('bs_apply_openapi_bootstrap',3,true),
 ('bs_apply_openapi_preview',2,true),
 ('bs_apply_openapi_preview_events',2,true),
 ('bs_apply_openapi_results',3,true),
 ('trigger_evaluate_ichika_escape_surge_alerts',0,false)
), observed_functions AS (
 SELECT p.proname AS name,p.pronargs AS nargs,p.prosecdef AS definer
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public'
), expected_constraints(tbl,kind,needle) AS (
 VALUES
 ('bs_race_events','u','(race_date, course_code, race_no)'),
 ('bs_race_entries','u','(race_date, course_code, race_no, boat_no)'),
 ('bs_race_entries','f','REFERENCES bs_race_events'),
 ('bs_race_results','u','(race_date, course_code, race_no)')
), observed_constraints AS (
 SELECT c.relname tbl, con.contype::text kind,pg_get_constraintdef(con.oid) definition
 FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
), expected_triggers(tbl,name) AS (
 VALUES
 ('bs_race_entries','bs_race_entries_exhibition_guard'),
 ('bs_race_entries','trg_ichika_escape_surge_on_exhibition_update'),
 ('bs_race_entries','trg_bs_reconcile_bootstrap_entry'),
 ('bs_race_entries','trg_bs_track_entry_first_seen'),
 ('bs_race_events','trg_settle_theory_recommendations'),
 ('bs_race_results','trg_bs_track_result_first_seen')
), observed_triggers AS (
 SELECT c.relname tbl,t.tgname name FROM pg_trigger t
 JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgenabled <> 'D'
)
SELECT 'FUNCTION_MISMATCH' issue,e.name object_name,
 format('expected args=%s definer=%s; observed args=%s definer=%s',
 e.expected_args,e.expected_definer,o.nargs,o.definer) detail
FROM expected_functions e LEFT JOIN observed_functions o USING(name)
WHERE o.name IS NULL OR o.nargs<>e.expected_args OR o.definer<>e.expected_definer
UNION ALL
SELECT 'CONSTRAINT_MISSING',e.tbl, e.kind||' '||e.needle
FROM expected_constraints e WHERE NOT EXISTS (
 SELECT 1 FROM observed_constraints o WHERE o.tbl=e.tbl
 AND o.kind=e.kind AND position(e.needle in o.definition)>0)
UNION ALL
SELECT 'TRIGGER_MISSING_OR_DISABLED',e.tbl,e.name
FROM expected_triggers e WHERE NOT EXISTS (
 SELECT 1 FROM observed_triggers o WHERE o.tbl=e.tbl AND o.name=e.name)
ORDER BY issue,object_name;
