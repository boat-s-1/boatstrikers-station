# PR298 — earliest core-table references in production migration order (2026-11-18)

## Method
Read-only SQL against `supabase_migrations.schema_migrations`, ordered by `version`, with `row_number()` and case-insensitive textual matching of the three core table names. This identifies **textual references**, not whether PostgreSQL must resolve a relation at CREATE FUNCTION time. No schema/data changes.

## Earliest references
| Stored migration sequence | Version | Name | Textual references |
| --- | --- | --- | --- |
| 1 | 20260819205859 | ai_v2_phase1 | none of the three |
| **2** | **20260819205938** | **ai_v2_training_refresh** | **bs_race_events, bs_race_entries, bs_race_results** |
| 3 | 20260819210143 | ai_v2_escape_label_fix | bs_race_results |
| 4 | 20260819210227 | ai_v2_escape_label_fix_v2 | bs_race_results |
| 5 | 20260819210740 | ai_v2_training_top3_recovery | all three |
| 7 | 20260820170334 | ai_v2_training_rows_compact | all three |
| 12 | 20260820210127 | ai_v2_public_character_stats | bs_race_results |

A separate earlier check of the first 12 stored migrations found no direct CREATE TABLE for any of these three. This does not exclude dynamic DDL, a pre-existing baseline, or dependencies whose resolution is deferred.

## Operational consequence
A version-correct schema baseline needs to be established **before replaying migration #2**, but this does not imply migration #2 itself fails without those tables; the first actual failing statement may occur later. The older, unrelated failed isolation branch logged missing `public.bs_race_results` at migration `20260820210127` (#12). The failed PR298 branch's exact failing SQL is still unknown.

## Release gate
Keep PR298 Draft/HOLD. Do not substitute the November catalog-derived isolation candidate for a proven historical baseline, or recreate a paid branch without fresh explicit approval. No production DB/Cron changes.
