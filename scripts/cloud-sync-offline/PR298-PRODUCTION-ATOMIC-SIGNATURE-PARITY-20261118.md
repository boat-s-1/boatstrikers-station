# PR298 — production atomic-writer signature and column parity (read-only, 2026-11-18)

Status: **schema-level parity checked; deployment remains HOLD**. No SQL write, live provider request or Cron modification was performed.

## Read-only checks

Inspected `information_schema.columns` for the existing `public.bs_race_entries`, `public.bs_race_events` and `public.bs_race_results` tables. All result-conflict guard columns referenced by `openapi-atomic-ingest.candidate.sql` were present:

- Entries: `actual_course`, `actual_st`, `actual_start_timing`, `arrival_order`, `finish_place`, `racer_registration_no`, `result_note`.
- Events: `exacta`, `exacta_payout`, `quinella`, `quinella_payout`, `trifecta_payout`, `trio`, `trio_payout`, `winning_technique_code`. A separate read-only query also confirmed `bs_race_events.trifecta` exists with type `text`.
- Results: `first_boat`, `second_boat`, `third_boat`, `trifecta_result`, `trifecta_payout`, `winning_method`.

Read-only `pg_proc` check confirmed the four existing writer signatures and return types:

| Writer | Input argument types | Return | Security |
| --- | --- | --- | --- |
| `bs_apply_openapi_bootstrap` | jsonb, jsonb, timestamptz | jsonb | DEFINER |
| `bs_apply_openapi_preview` | jsonb, timestamptz | jsonb | DEFINER |
| `bs_apply_openapi_preview_events` | jsonb, timestamptz | jsonb | DEFINER |
| `bs_apply_openapi_results` | jsonb, jsonb, timestamptz | jsonb | DEFINER |

The candidate calls these four functions in the expected order with matching argument types. **Signature parity does not prove runtime success**: definer permissions, search paths, trigger fan-out, constraints, existing result conflicts, atomic rollback and concurrency still require isolated live-schema testing.

## Release decision

**HOLD**. No production installation, Cron change, historical repair or paid Supabase branch creation authorized by this read-only check. Before deployment, verify remaining non-guard referenced columns, function execution role, RLS/grants, and run a realistic isolated database test.
