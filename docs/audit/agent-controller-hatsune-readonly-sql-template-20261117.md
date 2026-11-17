# AI司令塔 — 初音ニュース集計SQLの隔離レビュー（2026-11-17）

Created `tools/agent-controller/sql/hatsune-cron-aggregate-readonly.sql` and 20 offline contract tests. This is a reviewable SELECT-only SQL template, **not** a deployed query or scheduled job.

## Query boundaries
- A single statement timestamp determines the rolling 21-day window and excludes the most recent 3 minutes.
- Only `public.hatsune_news_cron_runs` records with `job_name='pipeline'` are counted.
- A scalar subquery counts `public.hatsune_news` records created in the two minutes after each run started; results are aggregated only.
- The output matches the existing strict aggregate intake schema: observed_at, window_start, window_end, runs_total, running_without_finish, partial_runs, windows_with_articles, temporal_article_matches.
- No raw article body, URL, personal data, individual run IDs, secrets, or mutation statements are returned.

## Limitations and pre-execution gates
- A temporal article match is **not** proof of per-run causality; overlapping windows can count the same article more than once.
- The rolling-window numbers may change between observations.
- Static tests check SQL text patterns, not database execution plans, privileges, runtime performance or semantics.
- Before running against production: confirm the actual schema, read-only role and least privilege, query plan/indexes and execution budget, bounded output, correct timezone semantics, and explicit operator review.
- This query must never be used to trigger automatic retry or republishing.

No live SQL was executed as part of adding this template. No production DB/Cron/provider API/Vercel modifications.
