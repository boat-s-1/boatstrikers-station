# 初音ニュース — 登録競合と不明な保存結果の安全判定 (2026-11-17)

## Scope
Added `news-insert-outcome.mjs` with 12 offline tests. This is a pure evidence classifier; it is **not wired** into `lib/boatstrikersGeneralNewsSync.js` or production.

## Decision rules
- PostgreSQL `23505` (unique violation): `unique_conflict_review`; no retry or overwrite.
- Other sanitized SQL error code: `insert_error_review`; no retry.
- No error and full reported insert count: `insert_count_reported`, **not** proof of publication/delivery.
- Partial reported count: `partial_count_review`.
- Missing insert response: `unconfirmed`, **not** proof of no side effects.
- No branch permits automatic retry, republishing, or overwriting existing articles.

## Limitations
- A single error code cannot establish whether other side effects occurred in earlier stages.
- SQL uniqueness is guaranteed only for non-NULL identical `source_key` values; same title/different key remains unprotected.
- No live concurrency, transaction, or race-condition tests were run.
- A future production patch should use atomic conflict-safe insertion only after reviewing batch semantics, source key normalization, metrics, and the risk of silent skipping. Requires separate approval.

No production writes, deployments, retries, or Cron changes.
