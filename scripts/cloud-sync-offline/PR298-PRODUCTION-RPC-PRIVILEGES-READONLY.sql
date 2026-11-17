-- PR298 read-only inspection of the actual production OpenAPI caller.
-- Never invoke these functions: the existing caller performs HTTP and writes.
SELECT p.proname,
       p.prosecdef AS security_definer,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') AS service_role_execute,
       CASE WHEN p.proname='bs_sync_openapi_today'
         THEN position('bs_apply_openapi_bootstrap' IN pg_get_functiondef(p.oid))>0
         ELSE NULL END AS sync_calls_bootstrap,
       CASE WHEN p.proname='bs_sync_openapi_today'
         THEN position('bs_apply_openapi_results' IN pg_get_functiondef(p.oid))>0
         ELSE NULL END AS sync_calls_results
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
 ('bs_sync_openapi_today','bs_apply_openapi_bootstrap',
  'bs_apply_openapi_preview','bs_apply_openapi_results')
ORDER BY p.proname;

-- Only metadata; avoid logging function source with credentials or endpoints.
-- A successful privilege check does NOT prove upstream program data completeness.
