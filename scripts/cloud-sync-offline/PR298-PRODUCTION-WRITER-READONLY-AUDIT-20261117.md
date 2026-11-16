# PR #298 — Production writer contract audit (read-only, 2026-11-17)

Scope: **read-only** inspection of `pg_proc` in production Supabase `rzosrbkyniyedolhkgxo`. No production SQL modifications, migrations, Cron edits, deployments, or real writer calls. This is an audit of **actual installed function definitions**, not an isolated end-to-end test.

## Confirmed production function signatures

| Writer | Input signature | Security |
|---|---|---|
| `bs_apply_openapi_bootstrap` | `(jsonb events, jsonb entries, timestamptz)` | SECURITY DEFINER |
| `bs_apply_openapi_preview` | `(jsonb rows, timestamptz)` | SECURITY DEFINER |
| `bs_apply_openapi_preview_events` | `(jsonb rows, timestamptz)` | SECURITY DEFINER |
| `bs_apply_openapi_results` | `(jsonb results, jsonb entries, timestamptz)` | SECURITY DEFINER |
| `evaluate_ichika_escape_surge_alerts` | `()` | SECURITY INVOKER |

## Bootstrap behavior observed in actual production function body

- Inserts into `bs_race_events` with a synthetic negative `id`; `ON CONFLICT (race_date, course_code, race_no) DO NOTHING`.
- Inserts six `bs_race_entries` with synthetic negative IDs; `ON CONFLICT (race_date, course_code, race_no, boat_no) DO NOTHING`.
- Maps the eight extended fields required by the PR #298 Cron mapper: `course_name`, `national_2_rate`, `local_2_rate`, `flying_count`, `late_count`, `motor_2_rate`, `boat_2_rate`, `racer_weight`.
- **Important:** `DO NOTHING` means existing event/entry rows are not refreshed by bootstrap. A separate freshness/reconciliation policy is needed if existing rows contain missing or stale program data. Do not assume replay repairs every field.

## Results writer behavior observed in actual production function body

- Upserts `bs_race_results`, including winning method, trifecta and first/second/third boat; it sets `result_status='confirmed'` and `race_status='finished'` on inserted rows.
- Updates `bs_race_entries` for `arrival_order`, `finish_place`, `actual_course`, `actual_start_timing`/`actual_st`, and notes **only where matching entries already exist**.
- Updates `bs_race_events` with payouts, result flags and source/timestamps **only where matching events already exist**.
- This directly confirms why result-only Cron ingestion can leave missing event/entry records: results writer does not create them. Candidate ordering bootstrap → preview → preview events → results is necessary.
- Conflict updates in results writer use `coalesce(existing, excluded)` for some status/source timestamps; replay cannot be assumed to overwrite all older metadata.

## Remaining gates

1. Execute the **real four writer definitions** against an isolated schema with actual column/constraint/trigger fidelity; prior CI uses stub phase writers.
2. Assess `trg_ichika_escape_surge_on_exhibition_update` fan-out under six boat inserts and decide safe trigger mitigation or acceptance criteria before production cutover.
3. Verify the current official OpenAPI response schema from a suitably dated, provenance-checked snapshot (not a stale `today.json` cache), including missing and partial settlement.
4. Validate existing-row replay semantics and data freshness before historical backfill.
5. Obtain explicit production cutover approval. **PR remains Draft/HOLD.**

Evidence: production read-only `pg_proc` function signatures and `pg_get_functiondef` of `bs_apply_openapi_bootstrap` and `bs_apply_openapi_results`, inspected 2026-11-17.
