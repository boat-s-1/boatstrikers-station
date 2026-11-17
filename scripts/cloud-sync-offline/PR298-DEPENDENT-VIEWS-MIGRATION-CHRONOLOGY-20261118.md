# PR298 — dependent view chronology from stored migration text (2026-11-18)

Production `supabase_migrations.schema_migrations` was queried with SELECT only. This is the earliest **textual mention**, not necessarily the original CREATE VIEW or deployment time.

| Current dependent view | Earliest migration version mentioning name | Mentions |
| --- | --- | ---: |
| `v_bs_race_page` | `20260901213035` | 1 |
| `v_elimination_training_entries` | `20260905152357` | 2 |
| `v_elimination_training_races` | `20260905152357` | 3 |
| `v_bs_race_results_confirmed` | `20260907145857` | 2 |
| `v_bs_x_night_candidates` | `20260910194212` | 1 |

All five first textual mentions are later than early migration #2 `20260819205938 ai_v2_training_refresh`. Consequently, do not automatically insert today's five views into a pre-August genesis baseline. Replay should derive them from version-correct migrations where supported, and compare final definitions separately.

The **five core training dependencies** (`bs_race_events`, `bs_race_entries`, `bs_race_results`, `bs_race_result_entries`, `racer_gender_master`) still lack provenance-backed initial CREATE TABLE statements in the 133 stored migration records. Missing original baseline is unresolved.

CI: commit `c592ec4b8f14ea672b307a16ddd3842a10317749` offline contract #368 PASS (44163122935); PostgreSQL fixture #363 was still in progress at first check. Neither CI constitutes full migration replay.

PR remains Draft/HOLD. No production DB/Cron writes or paid branch.
