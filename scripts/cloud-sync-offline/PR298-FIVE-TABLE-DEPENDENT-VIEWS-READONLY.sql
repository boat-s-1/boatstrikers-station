-- PR298 read-only dependent-view inventory for five early tables.
-- One output row per source table/view; dependency_records are NOT distinct views.
-- Current pg_catalog only; no assertion about historical creation order.
SELECT c.relname AS source_table,
       n2.nspname AS dependent_schema,
       v.relname AS dependent_view,
       count(*)::int AS dependency_records
FROM pg_depend d
JOIN pg_class c ON c.oid=d.refobjid
JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_rewrite rw ON rw.oid=d.objid AND d.classid='pg_rewrite'::regclass
JOIN pg_class v ON v.oid=rw.ev_class
JOIN pg_namespace n2 ON n2.oid=v.relnamespace
WHERE n.nspname='public'
  AND c.relname IN (
    'bs_race_events','bs_race_entries','bs_race_results',
    'bs_race_result_entries','racer_gender_master'
  )
  AND d.deptype='n'
GROUP BY c.relname,n2.nspname,v.relname
ORDER BY c.relname,dependency_records DESC;
