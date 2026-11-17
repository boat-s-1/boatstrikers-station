# 初音Cron実行時間と終了記録の切り分け (2026-11-17)

Read-only production aggregate, rolling 21 days, job_name='pipeline':
- `partial`: 28 runs; duration average 56,002 ms; minimum 45,774 ms; maximum 59,203 ms.
- `partial` durations >=55 seconds: 19/28; >=58 seconds: 9/28; >=59 seconds: 1/28.
- `running`: 35 runs; all lack finished_at and duration_ms, despite started_at being present.
- Route `app/api/cron/hatsune-news-pipeline/route.js` declares `maxDuration=60` (seconds).

## Interpretation
Completed `partial` runs often have little headroom relative to the configured 60-second limit. This increases concern about time-budget pressure but does not prove the runtime killed the 35 unfinished runs. Other possible causes include logging update errors, network failure, process interruption, or mismatched runtime limits.

## Safe measures
- New isolated `cron-runtime-budget.mjs` records `limited_headroom` for completed runs with <=5 seconds remaining; missing completion remains `unknown`, not a confirmed timeout.
- Do not extend runtime, change Cron cadence, replay pipeline, or publish duplicate articles without separate review.
- Next diagnostic: inspect runtime logs/termination status through read-only metadata, if available, and benchmark stage timings in a non-production environment.

No production changes.
