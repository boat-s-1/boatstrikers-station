-- PR298 production RLS / role inventory. READ-ONLY.
-- Compare with isolation candidate; does not attempt writes or change roles.
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls,
       COUNT(p.polname) FILTER (WHERE p.polcmd IN ('a','w','d','*')) AS write_policies
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid=c.oid
WHERE n.nspname='public'
  AND c.relname IN ('bs_race_events','bs_race_entries','bs_race_results',
                    'bs_source_first_seen','bs_theory_recommendations',
                    'bs_ichika_escape_surge_alerts')
GROUP BY c.oid
ORDER BY c.relname;

SELECT rolname,rolbypassrls,rolsuper
FROM pg_roles
WHERE rolname IN ('anon','authenticated','service_role')
ORDER BY rolname;

SELECT c.relname AS table_name, r.rolname,
       has_table_privilege(r.rolname,c.oid,'SELECT') AS can_select,
       has_table_privilege(r.rolname,c.oid,'INSERT') AS table_insert_grant,
       has_table_privilege(r.rolname,c.oid,'UPDATE') AS table_update_grant,
       has_table_privilege(r.rolname,c.oid,'DELETE') AS table_delete_grant
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN pg_roles r
WHERE n.nspname='public'
  AND c.relname IN ('bs_race_events','bs_race_entries','bs_race_results',
                    'bs_source_first_seen','bs_theory_recommendations',
                    'bs_ichika_escape_surge_alerts')
  AND r.rolname IN ('anon','authenticated','service_role')
ORDER BY c.relname,r.rolname;
