# AI司令塔 — 初音ニュース読み取り専用診断（2026-11-17）

## Evidence and method
A read-only aggregate SQL query inspected `public.hatsune_news_cron_runs` for `job_name='pipeline'` over a rolling 21-day interval, excluding starts in the most recent 3 minutes. Articles in `public.hatsune_news` were counted when their `created_at` was within 2 minutes after a run's `started_at`. The query does not export article text, user data or credentials. As a rolling window, totals can differ from earlier snapshots.

| Reported run status | Runs | Missing completion | Windows with >=1 article | Temporal article matches | Published flags in matched articles | Run-reported inserted |
|---|---:|---:|---:|---:|---:|---:|
| running | 34 | 34 | 32 | 295 | 291 | 0 |
| partial | 29 | 0 | 26 | 133 | 131 | 133 |
| total | 63 | 34 | 58 | 428 | 422 | 133 |

**Caveat:** These are temporal matches, not verified per-run attribution. An unfinished run reporting 0 inserted is not proof of no insertions. The published flag is DB state, not public web or Discord delivery evidence. The 2-minute windows may overlap with other writers. Scheduler invocation, pipeline completion, article creation and delivery must be displayed separately.

## New offline report component
`tools/agent-controller/news-cron-aggregate-diagnostic.mjs` takes aggregate counts as explicit input and returns a conservative summary with `production_health='未確認'` and `automatic_replay_allowed=false`. Twelve tests cover input validation, uncertain completion, and evidence limits. It does not query Supabase or run on production.

## Next safeguards
Review the source of repeated `running` rows with Vercel 60-second timeout evidence, establish per-run attribution where possible, and ensure duplicate-safe handling before any approved production integration. No live writes, retries, schedule changes, deployments, or merges.
