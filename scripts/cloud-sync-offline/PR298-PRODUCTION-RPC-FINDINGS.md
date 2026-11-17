# PR298 — Production RPC evidence (read-only, 2026-11-17)

This is a production metadata observation, not a live deployment test.

## Confirmed
- `public.bs_sync_openapi_today()` fetches `/api/v1/today.json`,
  extracts preview and result payloads, then calls
  `bs_apply_openapi_preview`, `bs_apply_openapi_preview_events`
  and `bs_apply_openapi_results`.
- The active function **does not call** `bs_apply_openapi_bootstrap`.
  That explains how result-only days can occur when Windows program input
  is unavailable.
- `bs_apply_openapi_bootstrap` is present and inserts race events and
  six-boat entries with `ON CONFLICT DO NOTHING`; it is not currently
  integrated into the active today sync caller.
- Read-only privilege metadata showed `anon` and `authenticated`
  cannot execute `bs_sync_openapi_today`, bootstrap, preview or results;
  those functions are SECURITY DEFINER with restricted explicit ACLs.
- 2026-11-11: 144 result-linked races have complete six-boat programs.
  2026-11-12: 155 result-linked races have complete six-boat programs.
  2026-11-13 through 11-17: 732 result-linked races have no program rows.
  These counts cover **races with result rows**, not the official schedule.

## Not yet proven
- That the live `today.json` source includes complete, correctly mapped
  pre-race program data for all six boats. The current caller only parses
  preview/result objects, not the full program into bootstrap input.
- Production parity of candidate SQL and the full trigger/dependency graph.
- Authorized polling, provider licensing and cloud-only replacement of
  exhibition/BRDB-specific fields.

## Next engineering verification
1. Obtain a permitted, non-sensitive OpenAPI example and verify the exact
   `programs.stadiums.*.races.*` structure and six registration identities.
2. Build an explicit, testable parser for bootstrap `p_events/p_entries`
   from the actual source; reject incomplete schedules rather than
   synthesizing registration numbers.
3. Run the atomic candidate in a production-compatible isolated database,
   including negative cases and transaction rollback.
4. Obtain separate approval before installing the function or changing the
   production Cron. Do not invoke `bs_sync_openapi_today()` as a diagnostic.

Read-only diagnostic: `PR298-PRODUCTION-RPC-PRIVILEGES-READONLY.sql`.
