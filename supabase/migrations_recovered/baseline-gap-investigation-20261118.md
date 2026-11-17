# Baseline gap investigation — 2026-11-18

## Scope and safety
Read-only production catalog and migration-registry queries; read-only GitHub SQL inspection. No SQL execution from recovered files, no production DDL/DML, no Cron changes, no PR #297 merge or deployment. This report is not an authorization to replay migrations.

## Verified observations
- Production `public.bs_race_results` exists as an ordinary table with RLS enabled. Its columns include `race_date`, `course_code`, `race_no`, `first_boat`, `trifecta_result`, and `winning_trifecta`.
- Production `public.ai_v2_daily_rankings` exists, has `data_timing`, and has RLS enabled.
- The first recovered migration `20260819205859_ai_v2_phase1.sql` creates AI v2 tables, but does not create `bs_race_results`.
- The second recovered migration `20260819205938_ai_v2_training_refresh.sql` defines a function referencing `public.bs_race_results`.
- The twelfth recovered migration `20260820210127_ai_v2_public_character_stats.sql` defines a SQL-language `SECURITY DEFINER` function with a direct JOIN against `public.bs_race_results`. This is consistent with the reported clean-branch failure `42P01`.
- A read-only search across production `supabase_migrations.schema_migrations.statements` for `CREATE TABLE public.bs_race_results` (including `IF NOT EXISTS` syntax) returned no rows. This is a targeted pattern search, **not proof that no alternative DDL or bootstrap mechanism ever created the table**.
- A previous recovery audit found 133 recovered SQL payloads, 9 with Cron scheduling markers, 38 with destructive-looking lexical tokens, and 46 with privilege tokens. These are lexical counts, not semantic safety assessments.

## Root-cause assessment
**High confidence: a baseline dependency gap.** The migration registry is insufficient on its own to establish a fresh database with the prerequisite result table. The exact historical origin of the table (manual SQL, schema bootstrap, another repository, restore, or other mechanism) remains **unverified**.

## Required design before replay
1. Capture a **schema-only**, sanitized inventory of required baseline objects: tables, columns, types, defaults, constraints, indexes, sequences, extensions, functions, triggers, policies, grants, and dependencies. Never export production rows, tokens, Cron command bodies, connection strings, or secrets.
2. Distinguish **baseline objects absent from all recovered migrations** from objects intentionally created later. Use catalog dependency queries and parse all recovered SQL in version order; avoid assuming `IF NOT EXISTS` proves compatibility.
3. Build a disposable **bootstrap baseline** that creates only missing prerequisite objects, with explicit schema, types, constraints, RLS, and access controls. Do not add an empty placeholder table merely to make the first failure disappear.
4. Keep recovered migration payloads immutable as evidence. Store any bootstrap SQL separately from `supabase/migrations` and `supabase/migrations_recovered` until tested and explicitly approved. Do not rewrite production migration history.
5. Before running any migration on a disposable database, block outbound HTTP and Cron execution, replace credentials with inert test values, and exclude immediate backfills/remote calls. Do not use production data.
6. Run staged PostgreSQL checks: bootstrap creation, first 11 migrations, migration 12, all remaining migrations in exact version order, function compilation and smoke tests, role/RLS checks, and idempotence checks. Record exact failing statement and SQLSTATE.
7. Compare resulting schema with a sanitized production schema-only reference, including grants/RLS and function security mode. Treat mismatches as blockers.
8. Only after offline tests pass, seek fresh authorization for a **new billable Supabase isolation branch**; ensure its migration/branch creation process cannot accidentally replay unsafe Cron operations or reach external services.
9. Delete the disposable branch and verify deletion after testing. Production DB, Cron, main, and PR #297 remain untouched.

## Current gate
**HOLD** on new Supabase branches, migration replay, production changes, and merge. Further schema-only inventory and static analysis are safe next steps. No complete 133-migration replay, offline PostgreSQL run, or production-equivalence proof has been performed in this investigation.
