# AI司令塔 — Cronスケジューラーとアプリ実行結果の照合 (2026-11-17)

## Read-only observations
From `cron.job_run_details` (rolling 7 days, three active Hatsune news jobs):
- `hatsune-news-1000-jst`: 7 succeeded, 0 other statuses observed
- `hatsune-news-1400-jst`: 7 succeeded, 0 other statuses observed
- `hatsune-news-2200-jst`: 7 succeeded, 0 other statuses observed

From `public.hatsune_news_cron_runs` (rolling 21 days, `job_name='pipeline'`):
- 35 `running` rows, all missing `finished_at` and `duration_ms`
- 28 `partial` rows, all with `finished_at`, `duration_ms`, and nonzero `error_count`

**Different lookback windows:** 7-day scheduler counts and 21-day app counts cannot be matched one-to-one. A scheduler success is not proof that news was generated, published, or sent.

## Interpretation
- Scheduler: observed launches reported `succeeded`.
- Application: recorded partial errors and apparently unfinished start rows warrant investigation.
- End-to-end pipeline health: **unknown**.
- Next: inspect the pipeline status-update implementation and correlate timestamps or run identifiers without collecting message bodies, secrets, or personal data.
- No thresholds enabled, no retries, no Cron edits, no production writes.
