# Hatsune NEWS — 7-day timeout diagnosis (read-only, 2026-11-17)

Production project `rzosrbkyniyedolhkgxo`, `public.hatsune_news_cron_runs`, JST dates 2026-11-11 through 2026-11-17. Queries only selected aggregated/sanitized status, short error prefixes, timings and counts. No production writes or Cron invocations.

- 21 pipeline rows: 16 `partial`, 5 `running`, 0 `success`, 0 `error`.
- All 16 `partial` rows have the same first error-message prefix: `boatrace: The operation was aborted due to timeout`.
- The 16 completed partial rows have durations **51,571–58,960 ms** and recorded totals **100 newly inserted articles**, **62 AI-generated articles**, **18 counted errors**. These totals are application-reported metrics, not independently reconciled with article rows.
- The five `running` rows have no `finished_at`; their stored zero metrics are defaults on unfinalized rows and **not evidence that zero work occurred**.
- The pipeline route exports `maxDuration = 60` seconds, so observed completed durations are close to the limit; this is correlation, not proof that the five incomplete runs timed out.
- The `boatrace` prefix appears in the pipeline's first selected error string. Do **not** attribute it to `lib/hatsuneNewsCollector.js` without tracing the actual producing function; that module labels its own errors `official:` and `raceData:`.

## Recommended next safe work
1. Locate the exact `boatrace:` error producer in source and determine configured timeout, cancellation, retry and fallback behavior.
2. Trace phase timings and identify which stages can run independently, while avoiding parallel DB writes or duplicate publication.
3. Design a smaller bounded worker with explicit per-phase deadline and durable checkpointing in an isolated branch. No direct change to live route until review.
4. Reconcile sample article IDs and statuses read-only with corresponding runs before making success/failure claims.
5. Do not automatically replay incomplete runs, as the first attempt may have written articles before its final log failed.

Release HOLD. No production mutation, external notification, additional paid branch or deployment.
