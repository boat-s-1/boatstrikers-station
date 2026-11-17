# Hatsune NEWS — boatrace timeout source traced (2026-11-17)

Source `lib/boatstrikersGeneralNewsSync.js` in `main`:
- General news `SOURCES` include `nikkan`, `macour`, and `boatrace` (official website).
- `FETCH_TIMEOUT_MS = 3500` and `fetchHtml` uses `AbortSignal.timeout(FETCH_TIMEOUT_MS)`.
- Source listing fetches use `Promise.allSettled`; rejected source fetches produce errors with `source.key + ': ' + message`, including `boatrace: ...timeout`.
- `app/api/cron/hatsune-news-pipeline/route.js` counts general source errors in `errorCount` and marks the overall run `partial` when any error is present.
- This matches the repeated `boatrace: The operation was aborted due to timeout` prefix in 16/16 completed partial runs in the inspected seven-day window.
- **Do not equate** the 3.5-second per-fetch deadline with the separate 60-second Next.js handler duration. Multiple operations, repairs, enrichments and AI generation run in the same handler.
- General news sync also repairs existing published rows and inserts new rows; **never call it or the pipeline as a monitoring probe**.

## Proposed remediation — NOT applied
1. Add phase-level duration and sanitized per-source outcome metrics without exposing URLs containing secrets or article contents.
2. Consider isolating slow sources from the critical pipeline path or retaining partial success with a distinct noncritical-source warning. Review business requirements before changing status semantics.
3. Test timeout thresholds with a local mock fetch, bounded concurrency and no external network calls. Raising timeouts blindly may worsen 60-second handler pressure.
4. Review publication/repair idempotency and partial-commit behavior before any retries.
5. Separate code PR and independent review required before any production change.

Current work adds only a static source-contract test to Draft PR #299. No live endpoint invocation, production modification, deployment or automatic retry.
