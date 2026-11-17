# Git migration history and local validation environment — 2026-11-18

Read-only GitHub REST history and local command availability check.

## Git history
- Queried repository `boat-s-1/boatstrikers-station` commit history restricted to `supabase/migrations`.
- Returned 62 commits, oldest dated 2026-08-20T21:03:34Z, SHA `bc2cd1b0dcbbcd33305468c5950648feacc8556a` (AI v2 public character stats function).
- Production migration registry includes earlier entries beginning `20260819205859`; this path-scoped Git history cannot alone reconstruct those early migrations.
- GitHub code search for exact phrase `create table public.bs_race_events` returned zero with `incomplete_results=true`; this is **not evidence of absence**.
- Branch listing first page contained 100 branches; not exhaustive. Other branches and other paths remain possible sources.

## Local execution prerequisites
- Checked availability of `psql`, `postgres`, `docker`, `pg_virtualenv` and PostgreSQL binary directory in current container; none found.
- No PostgreSQL replay was run, and no local PostgreSQL installation was attempted.
- Avoid claiming offline integration tests passed until a real PostgreSQL instance is available.

## Decision
Remain at static-audit stage. Do not create a paid Supabase branch, modify production, run Cron, or merge PR #297. Seek original historical bootstrap via alternate paths/branches or obtain a safe offline PostgreSQL runtime and independently reviewed schema baseline.
