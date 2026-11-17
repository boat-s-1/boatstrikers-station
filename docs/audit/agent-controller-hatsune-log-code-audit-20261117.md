# 初音ニュース pipeline 状態記録 — コード調査 (2026-11-17)

Read-only inspection of main branch:
- `lib/hatsuneCronLog.js`
- `app/api/cron/hatsune-news-pipeline/route.js`

## Confirmed behavior
1. `startHatsuneCronRun('pipeline')` inserts `status='running'` and `started_at` before collection begins.
2. `finishHatsuneCronRun` updates that row with `finished_at`, `duration_ms`, status, metrics and details.
3. Normal route completion sets `status='success'` if `errorCount===0`, otherwise `status='partial'`; the catch path sets `status='error'`.
4. **Potential observability bug:** the Supabase `.update(...).eq('id', run.id)` result is awaited but its `error` is never checked. An unsuccessful update can leave a `running` row without being surfaced by the logging helper.
5. Other possible causes of stranded `running` rows include route termination/timeouts between insert and update; `maxDuration=60` is configured. This code inspection alone does not prove which cause affected the 35 rows.
6. The route's `ok` response is derived from counted pipeline errors, not the success of the log update.

## Recommended next step (not executed)
- Add an isolated regression test for failed Supabase update response and implement explicit update-error handling on a **separate reviewed change**, without altering production yet.
- Correlate individual run timestamps with execution/timeout logs using read-only queries; avoid reading sensitive error_message/details fields.
- Keep scheduler-success and pipeline-success distinct. No auto-retries, restarts, or Cron changes.

No production writes or operational configuration changes performed.
