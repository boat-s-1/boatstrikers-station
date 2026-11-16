-- PR #298: read-only release preflight. Run with psql -X -v ON_ERROR_STOP=1.
-- This script never installs functions, modifies cron, or writes data.
WITH live_job AS (
 SELECT jobid,jobname,active,schedule,command
 FROM cron.job WHERE jobname='boatstrikers-openapi-live-3m'
), funcs AS (
 SELECT
  to_regprocedure('public.bs_sync_openapi_today()') AS legacy,
  to_regprocedure('public.bs_apply_openapi_atomic_candidate(date,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,timestamp with time zone)') AS atomic
), source_def AS (
 SELECT pg_get_functiondef(legacy) AS body FROM funcs
), checks AS (
 SELECT 'single_active_live_cron' AS name,
  (SELECT count(*)=1 AND bool_and(active) FROM live_job) AS passed
 UNION ALL SELECT 'legacy_job_not_modified',
  (SELECT bool_and(command ~* 'bs_sync_openapi_today') FROM live_job)
 UNION ALL SELECT 'atomic_candidate_installed', (SELECT atomic IS NOT NULL FROM funcs)
 UNION ALL SELECT 'atomic_service_role_only',
  (SELECT CASE WHEN atomic IS NULL THEN false ELSE
   has_function_privilege('service_role',atomic,'EXECUTE') AND
   NOT has_function_privilege('anon',atomic,'EXECUTE') AND
   NOT has_function_privilege('authenticated',atomic,'EXECUTE') END FROM funcs)
 UNION ALL SELECT 'legacy_function_still_without_bootstrap',
  (SELECT body !~* 'bs_apply_openapi_bootstrap' FROM source_def)
 UNION ALL SELECT 'legacy_function_still_without_atomic',
  (SELECT body !~* 'bs_apply_openapi_atomic_candidate' FROM source_def)
)
SELECT name,coalesce(passed,false) AS passed,
 CASE WHEN name IN ('legacy_function_still_without_bootstrap','legacy_function_still_without_atomic')
  THEN 'diagnostic_only' ELSE 'release_gate' END AS kind
FROM checks ORDER BY name;
-- Even all green does not authorize cutover: trigger fan-out, actual official
-- response, PostgREST, history backfill and explicit approval remain required.
