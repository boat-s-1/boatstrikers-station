# Nine candidate tables: ALTER chronology and typed schema probes (2026-11-18)

Read-only queries against production catalog and migration statement registry. No production writes or migration replay.

## Conventional ALTER TABLE detection
| Table | Migration versions with ALTER TABLE | First detected ALTER |
|---|---:|---|
| bs_race_entries | 5 | 20260823120912 |
| bs_race_events | 2 | 20260823120942 |
| bs_race_results | 1 | 20260823121913 |
| bs_member_notification_preferences | 2 | 20260830184310 |
| bs_news_candidates | 1 | 20260903162034 |
| bs_race_result_entries | 0 | — |
| bs_ai_predictions | 0 | — |
| bs_ai_bet_results | 0 | — |
| bsc_results | 0 | — |

No conventional DROP TABLE or TRUNCATE TABLE for these names was detected in the registered migrations. **Caveat:** lexical scan misses dynamic SQL, quoted identifiers, function-generated SQL and indirect changes. A zero ALTER count does **not** prove no later changes.

## Current typed schema spot checks
- `bs_race_result_entries`: 17 columns; key dimensions `race_date date NOT NULL`, `course_code smallint NOT NULL`, `race_no smallint NOT NULL`, `boat_no smallint NOT NULL`; `actual_start_timing numeric(8,3)`, `synced_at timestamptz NOT NULL DEFAULT now()`, `is_flying boolean DEFAULT false`, `is_late boolean DEFAULT false`.
- `bs_ai_predictions`: 27 columns; race dimensions plus `character_code text NOT NULL`, `timing text NOT NULL`; `bet_json jsonb NOT NULL DEFAULT '[]'`, `detail_json jsonb NOT NULL DEFAULT '{}'`, `published boolean NOT NULL DEFAULT false`, `predicted_at timestamptz NOT NULL DEFAULT now()`. Current catalog also includes `marks`, `factors`, `generated_at` and other columns; historical origin not yet proven.
- `bsc_results`: 14 columns; `id uuid NOT NULL DEFAULT gen_random_uuid()`; `race_date date`, `place text`, `race_no integer`, `category text` all NOT NULL; `invest integer NOT NULL DEFAULT 0`, `payout integer NOT NULL DEFAULT 0`, `hit boolean NOT NULL DEFAULT false`.

## Critical qualifications
The catalog represents today's schema, not the schema preceding migration 1. Current `id bigint` columns in race tables have no column default; do not invent IDENTITY or serial behavior without checking sequences/triggers and insert paths. Existing RLS must be retained, not broadened for testing.

## Next gate
Find original bootstrap sources or create a **non-executable** historical reconstruction with explicit uncertainty per column, then validate offline with PostgreSQL and all 133 recovered migrations. No paid branch or production/PR changes.
