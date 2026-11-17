# PR298 — additional dependencies in early stored migration (2026-11-18)

## Direct source
Production `supabase_migrations.schema_migrations` SQL text for migration `20260819205938 ai_v2_training_refresh` was read with SELECT only.

Its function `public.ai_v2_refresh_training_rows` references:
- `public.ai_v2_training_rows` (created by stored migration #1)
- `public.bs_race_entries`
- `public.bs_race_events`
- `public.bs_race_result_entries` **(additional core dependency)**
- `public.bs_race_results`
- `public.racer_gender_master` **(additional core dependency)**

Read-only `to_regclass` checks show both additional tables exist in production now. This does **not** prove when or how they were created. The function is PL/pgSQL, and relation resolution may be deferred until execution.

Migration `20260820210127 ai_v2_public_character_stats` is a SQL-language function joining `public.ai_v2_daily_rankings` to `public.bs_race_results`. On a separate older failed branch, this migration logged missing `bs_race_results`; do not assume that is the exact PR298 failure.

## Consequence
The genesis provenance search must include `bs_race_result_entries` and `racer_gender_master` and their column-level definitions, in addition to the original three. Do not claim the six-table current-state isolation candidate is a complete genesis baseline. Need historical provenance and full disposable chronological replay before production approval.

No writes to production DB or Cron; PR remains Draft/HOLD.
