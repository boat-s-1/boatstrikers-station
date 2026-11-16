-- PR #298 — READ ONLY release preflight. No functions installed, no cron changes.
-- Returns individual evidence gates, not an automatic production authorization.
WITH cron_state AS (
 SELECT count(*) AS jobs,
        bool_and(jobid=24 AND active AND username='postgres'
          AND schedule='10 16 * * *'
          AND btrim(command)='select public.bs_record_race_data_completeness(((now() at time zone ''Asia/Tokyo'')::date - 1));') AS expected_v2
 FROM cron.job WHERE jobname='boatstrikers-data-completeness-0110-jst'
), funcs AS (
 SELECT count(*) AS installed
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN (
  'bs_race_data_quality_rows_v3_candidate',
  'bs_race_data_completeness_v3_candidate',
  'bs_record_race_data_completeness_v3_candidate'
 )
), privileges AS (
 SELECT count(*) AS restricted
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN (
  'bs_race_data_quality_rows_v3_candidate',
  'bs_race_data_completeness_v3_candidate',
  'bs_record_race_data_completeness_v3_candidate'
 )
 AND has_function_privilege('postgres',p.oid,'EXECUTE')
 AND has_function_privilege('service_role',p.oid,'EXECUTE')
 AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
 AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
), source AS (
 SELECT count(*) AS result_only_races
 FROM public.bs_race_results r
 WHERE r.race_date BETWEEN date '2026-11-13' AND date '2026-11-16'
   AND NOT EXISTS (SELECT 1 FROM public.bs_race_events e
     WHERE e.race_date=r.race_date AND e.course_code=r.course_code
       AND e.race_no=r.race_no)
)
SELECT 'cron_still_v2_expected' AS gate,
       (jobs=1 AND coalesce(expected_v2,false)) AS passed,
       format('jobs=%s',jobs) AS detail FROM cron_state
UNION ALL SELECT 'v3_functions_installed',installed=3,format('installed=%s/3',installed) FROM funcs
UNION ALL SELECT 'v3_role_privileges',restricted=3,format('restricted=%s/3',restricted) FROM privileges
UNION ALL SELECT 'historical_result_only_baseline',result_only_races=600,
 format('result_only_races=%s (drift check, not completeness proof)',result_only_races) FROM source;
-- External notification, source integrity, isolated high-volume/trigger testing
-- and explicit production approval are mandatory MANUAL gates.
