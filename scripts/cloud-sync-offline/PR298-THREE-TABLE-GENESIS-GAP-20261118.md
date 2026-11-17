# PR298 — Three-table genesis gap in production migration history (2026-11-18)

**Read-only evidence; no production DB/Cron writes or paid branch creation.**

Production Supabase `rzosrbkyniyedolhkgxo` has 133 rows in `supabase_migrations.schema_migrations`. A case-insensitive direct-`CREATE TABLE` pattern search over their stored SQL found **zero** creation statements for all three core race tables, although all three exist:

| Table | Columns | Constraints | Noninternal triggers | RLS | Migration rows mentioning table | Direct CREATE TABLE matches |
|---|---:|---:|---:|---|---:|---:|
| `public.bs_race_events` | 56 | 6 | 2 | enabled | 35 | 0 |
| `public.bs_race_entries` | 107 | 7 | 6 | enabled | 39 | 0 |
| `public.bs_race_results` | 18 | 2 | 1 | enabled | 27 | 0 |

**Interpretation:** the stored migration history is not, by itself, demonstrated to be a complete genesis of these three production tables. The search does not rule out schema dumps, separate initial schema setup, dynamic SQL, renames, or Git-only migrations. In the older failed branch, `ai_v2_public_character_stats` errored on missing `public.bs_race_results` (2026-10-31 06:28:01 UTC). This is consistent with a missing base schema in replay, but the deleted PR298 branch's own failure version remains unknown.

Latest commit `a8f1f2640774d395243750141c2250d718c45d1f` passed both GitHub CI suites (offline contract #342, PostgreSQL fixture #337). These tests do not replay full Supabase migrations.

## Safe next gate

1. Locate the authoritative schema-only baseline, original bootstrap script, or schema dump for all three tables, not a minimal hand-written substitute.
2. Check the baseline's provenance, timestamp, and relationship to migration version ordering; avoid replaying already-applied changes.
3. Run a disposable **full** migration replay with explicit prerequisite assertions before `20260820210127`.
4. Inspect permissions, RLS, constraints, trigger functions, dependencies, and identity sequences before any new migration plan.
5. Keep PR298 Draft/HOLD; request fresh approval before a paid Supabase branch. Never modify production DB/Cron as part of diagnosis.
