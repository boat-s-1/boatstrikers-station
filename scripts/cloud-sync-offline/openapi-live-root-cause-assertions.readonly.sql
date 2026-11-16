-- PR #298 — READ ONLY: assertions against current live OpenAPI Cron function.
-- This is a structural regression detector, not proof of actual network input.
WITH fn AS (
 SELECT pg_get_functiondef('public.bs_sync_openapi_today()'::regprocedure) AS body
), schedule AS (
 SELECT count(*) AS jobs,
        bool_and(active AND command='select public.bs_sync_openapi_today();') AS expected
 FROM cron.job WHERE jobname='boatstrikers-openapi-live-3m'
), facts AS (
 SELECT body ILIKE '%bs_apply_openapi_preview(%' AS calls_entry_preview,
        body ILIKE '%bs_apply_openapi_preview_events(%' AS calls_event_preview,
        body ILIKE '%bs_apply_openapi_results(%' AS calls_results,
        body ILIKE '%bs_apply_openapi_bootstrap(%' AS calls_bootstrap
 FROM fn
)
SELECT 'openapi_cron_points_to_live_sync' AS assertion,
       (jobs=1 AND coalesce(expected,false)) AS passed,
       format('jobs=%s',jobs) AS detail FROM schedule
UNION ALL SELECT 'entry_preview_called',calls_entry_preview,'source inspection' FROM facts
UNION ALL SELECT 'event_preview_called',calls_event_preview,'source inspection' FROM facts
UNION ALL SELECT 'results_called',calls_results,'source inspection' FROM facts
UNION ALL SELECT 'bootstrap_missing_in_live_sync',NOT calls_bootstrap,
       'expected root-cause evidence; PASS means gap still exists' FROM facts;
-- A PASS on bootstrap_missing_in_live_sync is NOT a release gate PASS.
-- The route-based bootstrap is separately feature-flagged and not this Cron.
