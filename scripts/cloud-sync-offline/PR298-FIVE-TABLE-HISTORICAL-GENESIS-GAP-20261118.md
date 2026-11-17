# PR298 — five early dependency tables: read-only production inventory (2026-11-18)

## Evidence
Production catalog and `supabase_migrations.schema_migrations` were inspected using SELECT only.

| Table | Current columns | Current constraints | Non-internal triggers | RLS enabled | Stored migration direct CREATE TABLE |
| --- | ---: | ---: | ---: | --- | ---: |
| bs_race_events | 56 | 6 | 2 | yes | 0 |
| bs_race_entries | 107 | 7 | 6 | yes | 0 |
| bs_race_results | 18 | 2 | 1 | yes | 0 |
| bs_race_result_entries | 17 | 2 | 0 | yes | 0 |
| racer_gender_master | 7 | 2 | 0 | yes | 0 |

First three rows are from prior production catalog audit; final two were independently checked in this update. For the final two, textual mentions in 133 stored migrations: `bs_race_result_entries` 1; `racer_gender_master` 3. Regex found no direct CREATE TABLE for either. Dynamic SQL, renames, and external baseline are not ruled out.

Migration #2 `20260819205938 ai_v2_training_refresh` references all five tables inside PL/pgSQL. This does not establish exactly when missing objects cause compilation or runtime errors.

## CI
Commit `0731f9744ff5d789413f570f5af72e476851948e`:
- Offline contract #361 (run 44158536795): PASS.
- PostgreSQL fixture #356 (run 44158536833): PASS.
CI does not run full chronological Supabase migration replay.

## Release gate
The six-table isolation candidate must **not** be called a historical genesis baseline. A version-correct baseline needs five-table coverage at minimum, plus dependent objects and all later migrations. Keep PR Draft/HOLD. No production DB/Cron writes or new paid branch.
