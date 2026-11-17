# AI司令塔 — 読み取り専用Cron集計アダプター（隔離試作、2026-11-17）

Added `tools/agent-controller/readonly-cron-aggregate-adapter.mjs`, an offline-only strict schema for aggregate evidence. It does not open a database connection or run SQL.

## Allowlisted input
- `observed_at`, `window_start`, `window_end`: timezone-aware ISO timestamps.
- `runs_total`, `running_without_finish`, `partial_runs`, `windows_with_articles`, `temporal_article_matches`: nonnegative safe integer counts.

Unknown fields, including article bodies, keys, user identifiers and individual run IDs, are rejected. Basic count and window consistency checks apply. The returned aggregate does not claim authenticated input, per-run article causality, delivery, or healthy production state. It never allows replay.

## Future authenticated read-only source
A separately reviewed server-side adapter should use least-privilege credentials, a bounded time window, only aggregate SQL with explicit columns, and sanitized results; no raw rows or secrets should enter GitHub Actions artifacts. Independently verify the source and timestamp; the current schema only validates the caller-supplied shape. Do not wire provider APIs, TRINITY collection, Cron mutation, article insertion or notification sending.

17 offline tests. No production writes or deployment.
