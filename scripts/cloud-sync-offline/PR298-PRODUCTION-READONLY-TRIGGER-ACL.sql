-- PR #298: read-only production trigger workload and privilege inventory.
-- No DDL, DML, locks or RPC execution. Does not benchmark latency.
WITH today AS (
 SELECT (now() AT TIME ZONE 'Asia/Tokyo')::date AS d
), inventory AS (
 SELECT count(*)::bigint AS entry_rows,
   count(DISTINCT (course_code,race_no))::bigint AS races,
   count(*) FILTER (WHERE official_exhibition_time IS NOT NULL OR exhibition_time IS NOT NULL)::bigint AS exhibition_rows
 FROM public.bs_race_entries,today
 WHERE race_date=today.d
), trigger_inventory AS (
 SELECT count(*)::bigint AS active_trigger_count,
   count(*) FILTER (WHERE tgname='trg_ichika_escape_surge_on_exhibition_update')::bigint AS ichika_trigger_count
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public'
 AND c.relname IN ('bs_race_events','bs_race_entries','bs_race_results')
 AND NOT t.tgisinternal AND t.tgenabled<>'D'
), permission_inventory AS (
 SELECT coalesce(bool_and(NOT has_function_privilege('anon',p.oid,'EXECUTE')),false) AS anon_denied,
   coalesce(bool_and(NOT has_function_privilege('authenticated',p.oid,'EXECUTE')),false) AS authenticated_denied,
   coalesce(bool_and(has_function_privilege('service_role',p.oid,'EXECUTE')),false) AS service_role_allowed,
   count(*) AS checked_writer_count
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public'
 AND p.proname IN ('bs_apply_openapi_bootstrap','bs_apply_openapi_preview',
  'bs_apply_openapi_preview_events','bs_apply_openapi_results')
)
SELECT today.d AS jst_date,i.entry_rows,i.races,i.exhibition_rows,
 t.active_trigger_count,t.ichika_trigger_count,
 p.checked_writer_count,p.anon_denied,p.authenticated_denied,p.service_role_allowed,
 -- Upper-bound model: each inserted current-day boat row invokes evaluator.
 -- The evaluator currently scans the whole day's entries. This is an
 -- invocation estimate, NOT a measured query count or duration.
 (6 * i.races)::bigint AS six_boat_bootstrap_evaluator_invocations_estimate,
 CASE WHEN t.ichika_trigger_count<>1 OR t.active_trigger_count<>9
   OR p.checked_writer_count<>4 OR NOT p.anon_denied
   OR NOT p.authenticated_denied OR NOT p.service_role_allowed
 THEN 'HOLD: catalog drift or unexpected writer ACL'
 ELSE 'CATALOG ONLY PASS: full trigger load still untested' END AS gate
FROM today CROSS JOIN inventory i CROSS JOIN trigger_inventory t CROSS JOIN permission_inventory p;
