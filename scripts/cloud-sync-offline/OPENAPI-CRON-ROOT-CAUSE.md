# Production OpenAPI cron: read-only root cause evidence (2026-11-16)

Scope: inspected the current definition of `public.bs_sync_openapi_today()` through `pg_get_functiondef` using a SELECT. **No function was invoked and no database changes were made.**

## Verified behavior
- The function fetches `https://boatraceopenapi.github.io/api/v1/today.json` within the JST 07:00–23:30 window.
- It extracts preview rows and completed result rows.
- Its final application calls are `bs_apply_openapi_preview`, `bs_apply_openapi_preview_events`, and `bs_apply_openapi_results`.
- **It does not call `bs_apply_openapi_bootstrap`**, which is the existing RPC designed to insert missing base race events and entries.
- The separate Next.js `app/api/live/openapi-preview/route.js` does call `bs_apply_openapi_bootstrap` for current-day data, but both GET and POST invoke the write path; authentication and deployment protections need separate verification before any invocation.

## Operational consequence
The existing database cron can continue receiving previews/results while the base events/entries remain missing after the Windows worker stopped. This is a supported explanation of the observed split (600 result keys vs missing base events for 2026-11-13–16). It does **not** establish whether OpenAPI had all official programs available on those dates, nor does it establish complete equivalence with BRDB/PC-KYOTEI.

## Proposed next change (NOT IMPLEMENTED)
1. Extract OpenAPI program rows in a separately reviewed, authenticated worker; do not invoke the existing public-facing GET route.
2. Validate an independently sourced official race manifest, six boat entries per race, and data freshness. Fail closed on empty or incomplete input.
3. Run the existing bootstrap RPC in an isolated database with rollback and idempotency checks.
4. Verify foreign keys, race IDs, triggers, and preservation of official results/payouts.
5. Review and approve a separate production rollout after the isolated tests pass.

This file is documentation only; no production code is changed.
