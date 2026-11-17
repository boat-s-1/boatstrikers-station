-- PR298 READ-ONLY genesis preflight: inspect oldest stored migration dependencies.
-- No schema changes, no writes, no secrets.
WITH first_migrations AS (
  SELECT version, name, statements::text AS sql_text
  FROM supabase_migrations.schema_migrations
  ORDER BY version
  LIMIT 12
), core AS (
  SELECT unnest(ARRAY['bs_race_events','bs_race_entries','bs_race_results']) AS table_name
)
SELECT m.version, m.name, c.table_name,
       (m.sql_text ILIKE '%' || c.table_name || '%') AS referenced_in_migration,
       (m.sql_text ~* ('create[[:space:]]+table[[:space:]]+(if[[:space:]]+not[[:space:]]+exists[[:space:]]+)?(public[.])?' || c.table_name || '([^[:alnum:]_]|$)')) AS directly_created_in_migration,
       to_regclass('public.' || c.table_name) IS NOT NULL AS exists_now
FROM first_migrations m CROSS JOIN core c
ORDER BY m.version,c.table_name;

SELECT version,name
FROM supabase_migrations.schema_migrations
ORDER BY version
LIMIT 12;
