# Baseline schema inventory — 2026-11-18 (read-only)

## Method
Production PostgreSQL catalog SELECTs only, against project `rzosrbkyniyedolhkgxo`. No production rows exported, no DDL/DML, no Cron commands read or executed. This is an **inventory**, not a complete schema dump or replayable migration.

## Confirmed object summary
| Table | Columns | Constraints | Indexes | RLS policies | Noninternal triggers | RLS |
|---|---:|---:|---:|---:|---:|---|
| public.bs_race_results | 18 | 2 | 3 | 2 | 1 | enabled |
| public.bs_race_entries | 107 | 7 | 10 | 2 | 6 | enabled |
| public.ai_v2_daily_rankings | 17 | 6 | 3 | 1 | 1 | enabled |
| public.bs_race_events | 56 | 6 | not yet inventoried | not yet inventoried | not yet inventoried | enabled |

## Verified constraints and dependencies
- `bs_race_results`: primary key (`id`); unique (`race_date,course_code,race_no`).
- `bs_race_entries`: primary key (`id`); unique (`race_date,course_code,race_no,boat_no`); foreign key (`race_date,course_code,race_no`) -> `bs_race_events` with ON DELETE CASCADE; checks on boat number, course code, race number, and official exhibition course.
- `bs_ai_predictions` also has a foreign key to `bs_race_events`.
- `bs_race_results` has 18 columns. Required original-column definitions include: `id bigint NOT NULL` (no column default); `race_date date NOT NULL`; `course_code smallint NOT NULL`; `race_no smallint NOT NULL`; `result_status text NOT NULL DEFAULT 'finished'`; `synced_at timestamptz NOT NULL DEFAULT now()`; `first_boat integer`; `trifecta_result text`; `winning_trifecta text`. Other current columns were inventoried through read-only catalog query, but this note does not claim which columns existed at the initial baseline.
- `bs_race_events` has 56 columns including race keys, scheduling/weather/result/provenance fields. Its `id bigint NOT NULL` also has no column default; do **not** infer identity/sequence ownership or fabricate one.

## Security observations
- `bs_race_results` has two SELECT policies: one for anon/authenticated and another for PUBLIC, both with `USING (true)`.
- `bs_race_entries` has two SELECT policies for anon/authenticated, both with `USING (true)`.
- Policies alone do not establish effective access: ACL grants, role inheritance, SECURITY DEFINER functions and exposed schemas must be audited before any permissions are reproduced.
- Do not publish live data, credentials, Cron commands, or security-sensitive function bodies in audit outputs.

## Important qualification
The current schema reflects **all later migrations and manual changes**; it is not a historical snapshot of the schema that preceded migration 1. A baseline created by copying today's 18/107/56-column tables could conflict with later ALTER TABLE statements. Build a time-aware dependency inventory and distinguish initial columns from later additions before writing executable bootstrap SQL.

## Gate
HOLD on bootstrap execution, all 133 migrations, new paid branch, production changes, Cron changes, and PR #297 merge. Next work: inspect migration-by-migration ALTER/CREATE references, discover exact original baseline source, inventory sequence/identity/trigger/index/policy definitions, and run isolated offline checks without external networking.
