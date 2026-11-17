-- PR298 read-only current-catalog dependency inventory.
-- Counts pg_depend records, NOT unique dependent objects or historical creation order.
-- pg_proc dependencies do not reliably capture PL/pgSQL function-body references.
SELECT c.relname AS table_name,
  count(*) FILTER (WHERE d.classid='pg_rewrite'::regclass)::int AS rewrite_dependency_records,
  count(*) FILTER (WHERE d.classid='pg_proc'::regclass)::int AS function_dependency_records,
  count(*) FILTER (WHERE d.classid='pg_constraint'::regclass)::int AS constraint_dependency_records
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_depend d ON d.refobjid=c.oid AND d.deptype='n'
WHERE n.nspname='public'
  AND c.relname IN (
    'bs_race_events','bs_race_entries','bs_race_results',
    'bs_race_result_entries','racer_gender_master'
  )
GROUP BY c.relname
ORDER BY c.relname;
