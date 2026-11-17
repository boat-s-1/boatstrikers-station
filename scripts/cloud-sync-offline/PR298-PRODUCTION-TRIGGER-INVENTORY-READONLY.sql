-- PR298: READ-ONLY production trigger fan-out inventory.
-- No function invocation or writes; catalog metadata only.
SELECT c.relname AS table_name,
       t.tgname AS trigger_name,
       t.tgenabled AS enabled_code,
       p.proname AS trigger_function,
       pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_proc p ON p.oid=t.tgfoid
WHERE n.nspname='public'
  AND c.relname IN ('bs_race_events','bs_race_entries',
                    'bs_race_results','bs_race_result_entries')
  AND NOT t.tgisinternal
ORDER BY c.relname,t.tgname;
