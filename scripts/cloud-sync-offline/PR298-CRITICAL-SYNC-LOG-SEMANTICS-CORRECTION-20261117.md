# PR #298 — Critical correction: sync log cardinality semantics

**2026-11-17; production read-only function-definition inspection.**

The live production function `public.bs_sync_openapi_today()` was read directly from `pg_get_functiondef`.

## Confirmed facts

1. `entry_rows` in `bs_live_source_sync_logs` is **the number of preview/exhibition racer payload rows** (`jsonb_array_length(v_entry_rows)`), not the number of bootstrap/program racers.
2. `event_rows` in that log is **the number of preview event payload rows**, not the total number of scheduled race events.
3. The function invokes `bs_apply_openapi_preview`, `bs_apply_openapi_preview_events`, and `bs_apply_openapi_results`, but **does not invoke `bs_apply_openapi_bootstrap`**. The preview writers only UPDATE existing `bs_race_entries` / `bs_race_events` rows; they do not INSERT missing program rows.
4. Consequently, the previous assertion that deficits of 1/5/1/2 rows on Nov 13–16 prove missing individual *program* boats was **incorrect**. Those numbers represent preview-row counts relative to preview-event counts, where a six-row-per-event requirement is not justified.
5. The 11/12–11/13 boundary in persisted program rows is real: 11/11 and 11/12 have events/entries; 11/13 onward do not. But source program completeness and the exact cause of the boundary remain unproven.
6. Existing successful sync logs cannot validate bootstrap completeness; the old function does not perform bootstrap.

## Consequences

- Treat `PR298-PRODUCTION-READONLY-SOURCE-CARDINALITY.sql` as a **historical exploratory query only**, **NOT a readiness gate**. Its `success_logs_with_count_mismatch`, `max_count_delta` and `gate` fields have misleading semantics. Do not use it for acceptance.
- Do not use the related `PR298-NOV13-CARDINALITY-TRANSITION-20261117.md` claim of missing program boats as evidence. This correction supersedes it.
- Candidate atomic ingest still requires validation of the **actual `programs.stadiums.*.races.*.racers` bootstrap collection**, with unique boat identities and a production-equivalent fixture.
- Investigate which independent process inserted the 11/11 and 11/12 program rows and why it ceased. The absence of bootstrap from the current live sync is a plausible gap, but does not alone prove when or why another bootstrap path stopped.
- A new production monitoring query should distinguish (a) actual persisted program rows, (b) preview rows and (c) result rows, without comparing preview cardinality to 6 × preview event count.

**Safety:** no production write, Cron modification, Vercel operation or PR merge. Draft/HOLD remains.
