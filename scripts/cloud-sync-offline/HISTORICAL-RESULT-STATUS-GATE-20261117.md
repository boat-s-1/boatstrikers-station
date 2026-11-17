# Production recovery status gate — 2026-11-17 JST

Read-only query on production: 600 `bs_race_results` keys dated 2026-11-13 through 2026-11-16 still lack corresponding `bs_race_events` rows (156, 168, 156, 120 per date). All 600 results have `result_status='confirmed'` and a trifecta field present. The bootstrap RPC inserts new events as `race_status='scheduled'`, so a direct historical backfill would create inconsistent status unless a separately reviewed reconciliation step is included.

The isolated 1-race/6-boat test proved insert, duplicate no-op and a malformed-numeric rollback only. It did not include result rows, cancellation handling, full archive, event status reconciliation or downstream display/metrics checks.

Before production backfill: verify 600 source keys and six boats again immediately before writing; compare result records and cancellation flags; design a transactionally safe status/result reconciliation that does not overwrite newer provenance; run representative completed/cancelled fixtures and then all 600 in isolation; compare trigger side effects and row counts; review authentication and deployment path. Keep PR Draft and production recovery HOLD until these pass.
