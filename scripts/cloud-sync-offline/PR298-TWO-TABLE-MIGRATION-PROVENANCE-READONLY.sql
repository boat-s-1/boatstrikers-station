-- PR298 read-only: provenance of two early training dependencies.
-- Run against the existing production project ONLY as SELECT; no writes.
-- Regex matches direct CREATE TABLE text only, not dynamic SQL, renames or external baselines.
WITH migration_text AS (
  SELECT version, name, statements::text AS sql_text
  FROM supabase_migrations.schema_migrations
),
targets(table_name) AS (
  VALUES ('bs_race_result_entries'), ('racer_gender_master')
)
SELECT t.table_name, m.version, m.name,
  m.sql_text ILIKE '%' || t.table_name || '%' AS mentioned,
  m.sql_text ~* (
    'create[[:space:]]+table[[:space:]]+'
    || '(if[[:space:]]+not[[:space:]]+exists[[:space:]]+)?'
    || '(public[.])?' || t.table_name || '([^[:alnum:]_]|$)'
  ) AS direct_create_table
FROM targets t
CROSS JOIN migration_text m
WHERE m.sql_text ILIKE '%' || t.table_name || '%'
ORDER BY t.table_name, m.version;
