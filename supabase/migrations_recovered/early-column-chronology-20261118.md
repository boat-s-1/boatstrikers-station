# Early migration column chronology — 2026-11-18

Read-only inspection of production `supabase_migrations.schema_migrations.statements`; previews restricted to the beginning of matched ALTER TABLE statements. No SQL executed.

| Version | Target | Verified statement opening |
|---|---|---|
| 20260823120912 | bs_race_entries | ALTER TABLE ... ADD COLUMN IF NOT EXISTS api_exhibition_time numeric, api_exhibition_st numeric, api_exhibition_course smallint, api_tilt numeric, ... |
| 20260823120942 | bs_race_events | ALTER TABLE ... ADD COLUMN IF NOT EXISTS api_preview_synced_at timestamptz, api_wind_speed numeric, api_wind_direction_code text, api_wave_height numeric, ... |
| 20260823121913 | bs_race_results | ALTER TABLE ... ADD COLUMN IF NOT EXISTS api_result_synced_at timestamptz, api_result_source text; also bs_race_entries api_result_synced_at |
| 20260828131040 | bs_race_entries | exhibition_write_guard migration, ALTER TABLE adds columns; inspect full sanitized DDL before replay |

**Interpretation:** current production column definitions include additions from later migrations. A bootstrap based on current schema must omit/reconcile later-added columns, or later ALTER TABLE may conflict. Even `IF NOT EXISTS` may hide incompatible types/defaults, so require schema equivalence checks.

**Evidence limitations:** The scans searched conventional unquoted CREATE TABLE syntax in registry statements and did not find creation for four bs_* tables. They cannot rule out dynamic SQL, external bootstrap, restore, or earlier manual changes. The exact baseline remains unknown. This document is not a replayable SQL migration.

**Safety gate:** No production mutations, Cron changes, billable branch creation, or PR merge. Offline schema-only verification remains required.
