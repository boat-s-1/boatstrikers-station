# 初音ニュースCronのログ更新エラー対策 — 隔離プロトタイプ

Production code currently awaits `supabase.from('hatsune_news_cron_runs').update(payload).eq('id', run.id)` but does not check the returned `error` or whether a row was affected.

The isolated prototype `tools/agent-controller/cron-log-update-guard.mjs` checks:
- Supabase `error` must be absent.
- Exactly one row must be returned with an integer ID.
- Exceptions propagate; error messages from upstream are not echoed.

**Not production-ready wiring:** Supabase update requests must explicitly request the row with `.select('id')` for this guard to verify the affected row. This proposal is intentionally **not** imported by `lib/hatsuneCronLog.js` or any live route.

Before a production fix, review:
1. Whether the service-role client can update and return the intended row.
2. How an update failure should affect HTTP response and monitoring, without causing duplicate news posts or retries.
3. Timeouts and whether `running` rows are stranded for other reasons.
4. Regression tests for route behavior and logging errors.

No live writes, cron changes, or automatic recovery.
