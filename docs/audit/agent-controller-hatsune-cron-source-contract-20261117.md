# Hatsune NEWS Cron — source-grounded monitoring contract (2026-11-17)

Read-only inspection of `main` source files:
- `app/api/cron/hatsune-news-pipeline/route.js`: Next.js Node runtime, `maxDuration = 60`; authentication is either `CRON_SECRET` Bearer or a scheduler token checked against `hatsune_scheduler_config` via service-role Supabase. **Do not log or reuse either credential in the controller.**
- Handler calls `startHatsuneCronRun("pipeline")` before collection. Logging-start errors are caught and the pipeline continues, so an absent run record does **not** prove no execution.
- Normal completion calls `finishHatsuneCronRun` with `success` when `errorCount===0`, otherwise `partial`; outer catch calls it with `error` and returns HTTP 500.
- `lib/hatsuneCronLog.js`: `startHatsuneCronRun` inserts `running`, and `finishHatsuneCronRun` updates by run ID with `finished_at`, duration and counts. The final update's returned `error` is not checked. An uncompleted `running` record may therefore mean timeout, process interruption, logging/update failure or still-running execution. It is **not independently proof of failed news collection**.
- `vercel.json` in inspected `main` does **not** list `/api/cron/hatsune-news-pipeline`. `.github/workflows/hatsune-news-daily.yml` uses `workflow_dispatch` only (manual backup) and calls the production endpoint if manually run. Other scheduler configuration may exist outside these files; source inspection does not establish actual trigger schedule.
- `app/admin/hatsune-news-status/page.js` selects the latest 30 records from `hatsune_news_cron_runs` and labels jobs `pipeline` and `ai`. The page labels 22:20/22:40 JST but labels are not authoritative schedule evidence.

## Safe monitoring interpretation
1. Distinguish `running`, `success`, `partial`, `error`, and missing log rows.
2. Flag old `running` as `completion_unverified`, not confirmed failure; correlate read-only with Vercel invocation logs and actual article writes where authorized.
3. Treat `partial` as completed with at least one counted error, not total failure; inspect sanitized error category and counts.
4. Require an independently authenticated, read-only source query and a separate schedule provenance before making operational alerts.
5. Do not invoke the Cron endpoint for monitoring: it performs writes, external requests and AI generation.

This is source-code evidence, not verified runtime behavior. No production change, external call, or release authorization.
