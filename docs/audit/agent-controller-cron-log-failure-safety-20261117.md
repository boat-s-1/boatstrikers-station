# 初音ニュースCron — ログ保存失敗時の安全方針 (2026-11-17)

Inspected production source in `main`: `lib/hatsuneCronLog.js`, `app/api/cron/hatsune-news-pipeline/route.js`, and the table schema in `supabase/migrations/20260826_hatsune_news_cron_runs.sql`.

## Proposed contract (offline only)
- The news collection/generation result and log-persistence result must be represented independently.
- If the logging update fails or affects zero rows, record **log persistence unconfirmed** in diagnostics, not news pipeline failure or success.
- **Never automatically re-run the news pipeline** in response to a logging failure. The pipeline can have performed non-idempotent work.
- Do not automatically republish news or change Cron schedules.
- An operator should inspect the failed logging operation and downstream published state before taking any action.
- The isolated helper `tools/agent-controller/cron-log-failure-policy.mjs` and tests model this decision; neither is connected to live routes.

## Prerequisites for a production patch (HOLD)
1. Production code must request `.select('id')` after the `update(...).eq('id', run.id)` and verify the returned ID equals the expected run ID; the existing isolated guard currently only checks that one ID is returned.
2. Design a safe logging-error signal without including credentials, error messages, or sensitive payloads.
3. Test simulated failed writes and successful business execution, ensuring no automatic retry or duplicate posting.
4. Review operational behavior under request timeouts and any RLS/service-role restrictions.
5. Obtain explicit approval for production deployment; PR #299 stays Draft.

No production data, Cron schedules, or TRINITY collector changed.
