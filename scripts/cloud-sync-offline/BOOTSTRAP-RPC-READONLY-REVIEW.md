# Bootstrap RPC review — read-only, 2026-11-16

Inspected the production definition of `public.bs_apply_openapi_bootstrap(jsonb,jsonb,timestamptz)` via `pg_get_functiondef`. Did not invoke it.

## Confirmed
- Inserts missing `bs_race_events` first, then `bs_race_entries`, using `ON CONFLICT (race_date, course_code, race_no) DO NOTHING` and `ON CONFLICT (race_date, course_code, race_no, boat_no) DO NOTHING` respectively.
- Explicit deterministic negative bigint IDs are computed from race date, course, race number and boat number.
- Assigns `data_source = 'BOATRACE_OPEN_API_BOOTSTRAP'`.
- The function does **not** update existing event/entry rows on natural-key conflicts.
- It does not modify `bs_race_results` or payout tables directly in its SQL body.
- The function has `SECURITY DEFINER` and a `public` search_path; permissions and dependent triggers must be reviewed before production use.

## Not yet established
- Whether triggers, foreign keys, downstream consumers or materialized reports rely on a different positive-ID scheme.
- Whether negative-ID primary-key conflicts can occur with pre-existing records or with future import paths.
- Whether the natural-key uniqueness and race-date filters fully protect against malformed source payloads.
- Whether `ON CONFLICT DO NOTHING` on natural keys can still leave incomplete 6-boat records after partial upstream failure.
- Whether canceled/abandoned races should be marked `scheduled` when backfilling historical data.
- Whether one call per day with 120–168 races and 720–1008 entries fits RPC timeout and payload limits.
- Whether transaction rollback and repeated calls preserve all existing official results and payouts.

## Gate
Never call the production RPC for backfill before isolated DB verification and explicit production approval. A validated archive with 600/600 key parity is **necessary but not sufficient**.
