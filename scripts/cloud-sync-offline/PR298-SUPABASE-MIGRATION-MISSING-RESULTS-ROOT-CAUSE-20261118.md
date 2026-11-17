# PR298 — Concrete historical Supabase branch migration failure evidence (2026-11-18)

**Status: HOLD.** Investigation used read-only Supabase log queries on the *existing* older failed branch `gamagori-pr294-phase13` (`rdqnqvafsponsoetnezv`) and production migration-history SELECT. No production DB/Cron writes, paid branch creation, or unrelated branch deletion.

## Observed sequence, 2026-10-31 UTC

- `06:27:57.189`: `CREATE SCHEMA IF NOT EXISTS supabase_migrations`.
- `06:27:57.196`: `CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations`.
- `06:28:01.036`: execution of `create or replace function public.ai_v2_public_character_stats(p_as_of date default current_date)` (SQL, stable, security definer). The function's query joins `public.bs_race_results` to `public.ai_v2_daily_rankings`.
- At the **same timestamp**, PostgreSQL emitted `relation "public.bs_race_results" does not exist`.

This is strong direct evidence that a missing base table prevented that function's creation in the **older** branch's migration replay. The observed SQL maps to production migration-history version `20260820210127`, name `ai_v2_public_character_stats`, one stored statement, 1739 SQL characters. Production history confirms its text includes `join public.bs_race_results`.

## What this does and does not prove

- **Proved:** a failed SQL statement in the older branch's initialization referenced `public.bs_race_results` before that table existed.
- **Not proved:** the new PR298 branch `wfuplnvetkamgavdufqi` failed at the same migration. It was deleted after `MIGRATIONS_FAILED`; its logs are no longer available through the connector (`Project not found`).
- **Not proved:** why the table is missing in the replay source, whether a baseline schema is expected, or which earlier migration should create it.
- The first `supabase_migrations.schema_migrations does not exist` messages at `06:27:54` and `06:27:56` precede successful creation of that schema/table; they should not be mistaken for the fatal SQL statement.

## Recommended fix workflow (do not blindly change production)

1. Inventory migrations and schema bootstrap that create `public.bs_race_results` and its prerequisites. Determine whether the Supabase branch builder starts from empty schema and replays only migration history, or clones a baseline.
2. In disposable PostgreSQL, replay the exact ordering up to `20260820210127`; assert the table exists before `ai_v2_public_character_stats` is created. If absent, **stop with a clear dependency diagnostic**, not a fabricated placeholder table.
3. Repair the versioned migration/baseline in GitHub through a reviewed, replay-safe change. Never patch the production table or rewrite migration history based on this evidence alone.
4. Obtain fresh explicit approval for a new paid Supabase branch after a verified reproduction; no automatic retry.
5. Keep PR298 Draft and production/Cron cutover HOLD until full migration replay, real triggers, payload validation and rollback pass.

## Evidence sources

Supabase branch PostgreSQL logs from `2026-10-31T06:20:00Z` to `07:20:00Z`; production `supabase_migrations.schema_migrations` SELECT for version `20260820210127`; GitHub Actions success at PR298 commit `d38244bd439b9019d8a204366253f12ed6892d34` (offline contract #339 and PostgreSQL fixture #334).
