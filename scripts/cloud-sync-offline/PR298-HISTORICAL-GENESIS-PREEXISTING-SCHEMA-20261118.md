# PR298 — Migration history begins after core schema existed (2026-11-18)

## Read-only evidence

Production `supabase_migrations.schema_migrations` starts at `20260819205859 ai_v2_phase1`. Its own opening comment says **"New tables only. Existing prediction tables and production UI are not modified."** The first statement creates `public.ai_v2_training_rows`, not any of the six core race tables.

The second stored migration, `20260819205938 ai_v2_training_refresh`, defines a training refresh function whose SQL references existing `public.bs_race_entries` and `public.bs_race_events`. The third, `20260819210143 ai_v2_escape_label_fix`, references `public.bs_race_results`.

This is direct evidence that the earliest stored migrations are **incremental changes depending on pre-existing core tables**, not a complete bootstrap for an empty database. It explains why a fresh Supabase branch replay can encounter missing relation errors without proving the precise failing statement on the previously deleted PR298 branch.

## Evidence from GitHub Actions

Commit `83d15a07cafe47804065ed986bcfaf26e541b35e`: PostgreSQL fixture #347 and offline contract #352 both passed. PostgreSQL job `134288934476` logs:
- `PR298_PASS: anon INSERT rejected by RLS`
- `PR298_PASS: authenticated INSERT rejected by RLS`
- `PR298_PASS: no unauthorized rows persisted`

The RLS probe is a disposable purpose-built table, **not** a production API authorization test.

## Safe release gate

1. Locate a *historical, version-correct* pre-2026-08-19 schema snapshot or bootstrap, including extensions, roles, policies, triggers, dependencies, and migrations.
2. Do not insert the November 17 current-state six-table candidate before August migrations without proving compatibility; it is not a historical genesis baseline.
3. Continue read-only investigation and CI fixtures. Do not modify production DB/Cron, merge, or create another paid branch without approval.
4. PR298 remains Draft/HOLD; a successful fixture is not a full Supabase migration replay.
