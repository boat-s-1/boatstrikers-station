-- BoatStrikers capacity cleanup.
-- Run ONLY after tools/db/backup-retired-tables.ps1 has completed successfully
-- and both dump files have been verified non-empty.
-- Safety review on 2026-08-20 found no external views/functions/FKs/triggers referencing these two tables.

begin;

-- Intentionally no CASCADE. If an unexpected dependency appears, migration must fail rather than delete it.
drop table if exists public.ai_predictions_legacy_v81;
drop table if exists public.brdb_race_entries_raw;

commit;
