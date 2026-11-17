-- PR298 schema genesis dependency preflight. READ-ONLY. DO NOT MODIFY production.
-- Expected: all three core tables exist in production; these assertions are for an
-- isolated replay environment BEFORE applying ai_v2_public_character_stats.
WITH required(name) AS (
 VALUES ('public.bs_race_events'),('public.bs_race_entries'),('public.bs_race_results')
)
SELECT name, to_regclass(name) IS NOT NULL AS exists_before_dependent_migration
FROM required ORDER BY name;

-- Stored migration history cannot establish a complete schema genesis if these
-- creation statements are absent. Pattern matches direct CREATE TABLE only.
WITH required(name) AS (
 VALUES ('bs_race_events'),('bs_race_entries'),('bs_race_results')
)
SELECT r.name,
 count(m.version) FILTER (WHERE m.version IS NOT NULL) AS history_mentions,
 count(m.version) FILTER (WHERE array_to_string(m.statements,E'\n') ~*
 ('create[[:space:]]+table[[:space:]]+(if[[:space:]]+not[[:space:]]+exists[[:space:]]+)?(public[.])?'||r.name||'([[:space:]]|[(])')) AS direct_create_statements
FROM required r
LEFT JOIN supabase_migrations.schema_migrations m
 ON array_to_string(m.statements,E'\n') ILIKE '%'||r.name||'%'
GROUP BY r.name ORDER BY r.name;

-- Inspect whether the problematic dependent migration exists in replay history.
SELECT version,name,cardinality(statements) AS statement_count
FROM supabase_migrations.schema_migrations
WHERE version='20260820210127';
