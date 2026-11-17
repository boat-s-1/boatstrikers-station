# PR298 — Missing baseline table in migration history (2026-11-18)

**Read-only production investigation. No DB/Cron changes, no new paid branch. Release HOLD.**

## Verified facts

1. Production `to_regclass('public.bs_race_results')` returns `bs_race_results`: the relation currently exists.
2. Production `supabase_migrations.schema_migrations` contains **133** rows.
3. A targeted case-insensitive search across the stored SQL statements of all 133 rows for `CREATE TABLE [IF NOT EXISTS] [public.]bs_race_results` returned **zero** matches. This checks ordinary direct CREATE TABLE syntax, not every possible dynamic SQL, rename, restored baseline, or Git-only migration.
4. Migration `20260820210127` (`ai_v2_public_character_stats`) joins `public.bs_race_results`. The historical failed branch `gamagori-pr294-phase13` PostgreSQL log shows the `CREATE OR REPLACE FUNCTION` statement at `2026-10-31T06:28:01.036Z` followed by `relation "public.bs_race_results" does not exist` at the same timestamp.
5. Thus, a **missing baseline/schema dependency** is a strong explanation for the historical failure. This does not prove that the subsequently deleted PR298 branch failed at the same statement. Its build logs could not be retrieved after deletion.

## Implications

Migration history may not represent a complete replayable genesis of the production schema. Do **not** add a placeholder `bs_race_results` table just to satisfy the failing function; production may have columns, indexes, grants, RLS, triggers and dependencies that would be lost or misrepresented. Do not alter production migration history or schema.

## Next verification

- Inventory the exact production `bs_race_results` definition (columns, constraints, indexes, grants, RLS, dependencies) read-only and search for the authoritative schema baseline in repository/backup.
- Identify the branch builder's migration replay source and whether schema-only baseline restoration is supported.
- Build a *disposable* schema-only replay test with a reviewed, accurate baseline and explicit assertion that required tables exist **before** dependent function migrations.
- Retrieve logs from any future failed branch **before deleting it**, with a firm cost cap and user approval for new paid resources.
- Keep PR298 Draft and production Cron unchanged.

## Verification SQL (SELECT only)

```sql
SELECT to_regclass('public.bs_race_results')::text AS production_table;
SELECT count(*) FROM supabase_migrations.schema_migrations;
SELECT version,name
FROM supabase_migrations.schema_migrations
WHERE array_to_string(statements,E'\\n') ~*
  'create[[:space:]]+table[[:space:]]+(if[[:space:]]+not[[:space:]]+exists[[:space:]]+)?(public[.])?bs_race_results([[:space:]]|[(])';
```
