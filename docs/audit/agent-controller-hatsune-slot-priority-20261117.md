# 初音ニュース — JST時間帯別の診断優先順位 (2026-11-17)

Read-only SQL examined rolling 21 days of `hatsune_news_cron_runs` pipeline rows, excluding starts within 3 minutes, and counted `hatsune_news` rows created within 2 minutes of each start. Aggregates only, no article contents or raw errors.

| JST slot | Runs | Running / no completion | Partial | Zero-article windows | Article matches (temporal only) |
|---|---:|---:|---:|---:|---:|
| 10:00 | 21 | 11 | 10 | 0 | 91 |
| 14:00 | 21 | 7 | 14 | 5 | 19 |
| 22:00 | 21 | 16 | 5 | 0 | 318 |

## Investigation priority
An **illustrative, non-operational** ranking uses score = 3 × missing completion + 2 × partial + zero-article windows: 22:00 (58), 10:00 (53), 14:00 (54). This means the actual weighted ranking is **22:00 > 14:00 > 10:00**. We should prioritize completion timeouts at 22:00, partial/source errors at 14:00, then 10:00. Scores are arbitrary triage weights, not statistical severity or production alert thresholds.

## Evidence limits
Zero articles is not itself a failure; source availability and other writers can influence counts. Article matches do not attribute output to a specific run. Do not retry or republish.

New isolated module `cron-slot-priority.mjs` and tests. No live operational wiring, Cron changes, writes or deployments.
