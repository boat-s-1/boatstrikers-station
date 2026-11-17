# Fresh bootstrap gap: bs_race_results migration-history proof（2026-11-18）

A further read-only query of the production `supabase_migrations.schema_migrations` table established:
- 133 migration rows are recorded in production.
- 27 recorded migrations reference `public.bs_race_results`.
- The first reference is migration `20260819205938` / `ai_v2_training_refresh`.
- **Zero of the 133 recorded migrations contain an exact `CREATE TABLE public.bs_race_results` or `CREATE TABLE IF NOT EXISTS public.bs_race_results` statement.**
- The migration `20260820210127` later creates `ai_v2_public_character_stats(date)` as a SQL-language function that resolves `public.bs_race_results` during creation; this is where the fresh branch failed with SQLSTATE 42P01.

This proves `bs_race_results` was an assumed prerequisite before the first recorded migration that references it, not a table provisioned by the currently recorded 133 migrations. It does not identify the original DDL source. The source may be a pre-existing legacy schema, manual setup, another repository/deployment path, or an untracked historical artifact. No specific origin is asserted.

The same pattern may apply to other foundational relations. Before any ACL verification, inventory all dependencies referenced by the earliest migrations and compare them with objects explicitly created by migration history. Build a verified baseline/bootstrap layer from authoritative source only; do not synthesize missing tables based on current schema inspection alone.

No production or branch SQL was modified. The failed hourly branch was already deleted after evidence capture.
