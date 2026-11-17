# PR #298 — OpenAPI live bootstrap release design

Status: DRAFT / HOLD. No production SQL changes authorized.

## Confirmed structural root cause

Production Cron job 1 calls `public.bs_sync_openapi_today()` every three minutes during its configured UTC hours. That function fetches OpenAPI today.json, parses preview and results, and calls `bs_apply_openapi_preview`, `bs_apply_openapi_preview_events`, `bs_apply_openapi_results`. It **does not** call `bs_apply_openapi_bootstrap`. This is independently asserted in `openapi-live-root-cause-assertions.readonly.sql` (5/5 expected).

The separate Next.js `app/api/live/openapi-preview/route.js` can call `bs_apply_openapi_bootstrap` only for JST current day, under `BS_OPENAPI_TODAY_SYNC_ENABLED=true`. This is not invoked by Cron job 1.

## Candidate implementation boundaries

1. Prefer a single PostgreSQL transaction for bootstrap, preview, and result ingestion to avoid HTTP-level partial commits across three independent RPCs.
2. Parse program races and six racers from the same fetched OpenAPI document. Validate all race dates, 1–24 course codes, 1–12 race numbers, six distinct boats and racer IDs, and duplicate race keys **before any write**. An empty official schedule or malformed payload must fail closed; use independently checked schedule coverage, not fabricated race keys.
3. Call existing `bs_apply_openapi_bootstrap` with missing-only event and entry rows **before** dependent preview/result RPCs. Preserve authoritative BRDB/PC-KYOTEI fields; do not overwrite existing rows.
4. Benchmark triggers: each inserted entry fires `bs_guard_exhibition_write`, `bs_track_entry_first_seen`, and the Ichika evaluator trigger. On current-day inserts, the evaluator performs a whole-day scan per inserted boat. For a 100-race/600-entry batch, this can mean 600 evaluator invocations. Do not disable production triggers without a separate impact review.
5. Include advisory locking or another proven concurrency control, idempotency assertions, and a bounded execution time. Two overlapping three-minute Cron runs must not duplicate data or notifications.
6. Preserve or improve error logging. Existing `bs_sync_openapi_today()` re-raises after updating a log row inside its exception handler; PostgreSQL rollback semantics mean that log update is not necessarily durable after the error. Do not treat absence of error log rows as proof of success.
7. Test a complete transaction with six-boat fixture, replay, step failure/rollback, 100+ races, concurrency, source-priority reconciliation, and downstream alert side effects in a fresh isolated PostgreSQL environment.
8. Keep historical backfill distinct: current-day OpenAPI bootstrap cannot by itself restore 2026-11-13..16 missing events/entries.

## Current decision

Do not enable the Next.js feature flag or modify Cron 1 until the transactional bootstrap candidate and its trigger/load tests pass. V3 completeness detection and source ingestion repair are separate release tracks. PR remains Draft/HOLD.
