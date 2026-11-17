-- PR #298 read-only production routing gate. Never changes Cron or functions.
-- Expected HOLD until the live 3-minute job invokes an approved bootstrap path.
WITH job AS (
 SELECT jobid,jobname,schedule,command,active
 FROM cron.job WHERE jobname='boatstrikers-openapi-live-3m'
), fn AS (
 SELECT pg_get_functiondef('public.bs_sync_openapi_today()'::regprocedure) AS definition
), atomic AS (
 SELECT to_regprocedure('public.bs_apply_openapi_atomic_candidate(date,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,timestamp with time zone)') AS signature
)
SELECT j.jobid,j.jobname,j.schedule,j.active,
 (j.command ~* 'bs_sync_openapi_today') AS cron_uses_legacy_rpc,
 (f.definition ~* 'bs_apply_openapi_bootstrap') AS legacy_rpc_calls_bootstrap,
 (f.definition ~* 'bs_apply_openapi_atomic_candidate') AS legacy_rpc_calls_atomic,
 (a.signature IS NOT NULL) AS atomic_candidate_installed,
 CASE WHEN j.active
   AND (f.definition ~* 'bs_apply_openapi_atomic_candidate')
   AND a.signature IS NOT NULL
   THEN 'REVIEW_REQUIRED' ELSE 'HOLD' END AS atomic_routing_gate
FROM job j CROSS JOIN fn f CROSS JOIN atomic a;
