# 初音ニュースCron — 状態とスケジュールの読み取り専用監査 (2026-11-17)

## Evidence from production database (last 21 rolling days)
Table `public.hatsune_news_cron_runs`, `job_name='pipeline'`:
- `running`: 35 rows; all 35 have NULL `finished_at`, all have `error_count=0`.
- `partial`: 28 rows; all 28 have non-NULL `finished_at`, all have `error_count>0`.
- Start-hour distribution JST:
  - 10:00 — running 11, partial 10
  - 14:00 — running 8, partial 13
  - 22:00 — running 16, partial 5

## Active pg_cron schedules observed
- `hatsune-news-1000-jst`: `0 1 * * *` (10:00 JST)
- `hatsune-news-1400-jst`: `0 5 * * *` (14:00 JST)
- `hatsune-news-2200-jst`: `0 13 * * *` (22:00 JST)
- Other jobs with 'news' or 'hatsune' in the name also exist, including `boatstrikers-news-daily-2300-jst` and `hatsune-womens-inner-break-line`. These are separate and must not be conflated with the pipeline log.

## Interpretation / HOLD
- The log rows show scheduled start patterns, but **do not prove each run succeeded**.
- `partial` has recorded errors, but severity and expected behavior require code-level inspection.
- `running` may be orphaned start rows; do not assume 35 active jobs.
- No alert threshold or auto-remediation enabled. Next: inspect job implementation and correlate job execution logs without fetching sensitive payloads.
- TRINITY planned pause is unaffected.

This inspection used SELECT-only SQL; no schedules, jobs, API calls, or production data were modified.
