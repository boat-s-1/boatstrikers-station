# 初音ニュースCron — 21日×3枠の完全性監査 (2026-11-17)

Production read-only aggregate SQL of `public.hatsune_news_cron_runs`, rolling 21 days:

| JST hour | distinct dates | total rows | running | partial |
|---|---:|---:|---:|---:|
| 10 | 21 | 21 | 11 | 10 |
| 14 | 21 | 21 | 8 | 13 |
| 22 | 21 | 21 | 16 | 5 |
| total | 21 | 63 | 35 | 28 |

All 63 records fall in `running` or `partial`, with **zero `success` or `error` records observed**. The group-by query also found no duplicate records within a status/date/hour slot; total 21 rows per hour across 21 days indicates one recorded pipeline start per slot. It does not independently verify each expected scheduler execution or any downstream publication.

Earlier read-only checks found:
- 35 `running` records with no finish time or duration.
- 28 `partial` records with finish time, duration and nonzero error count.
- pg_cron job history for the last 7 days: 7 `succeeded` executions each at 10, 14, and 22 JST. pg_cron success does not mean the application pipeline completed successfully.
- Code in `lib/hatsuneCronLog.js` awaits a Supabase update but does not inspect its `error` result; timeout is another plausible explanation for unfinished records.

## Risk and recommended next read-only investigation
**Operator review warranted.** No end-to-end pipeline success can be established from these records. Do not assume no news was produced: side effects can precede a failed logging update.

1. Compare news publication counts/timestamps independently (aggregate only).
2. Inspect route execution/timeout evidence without exposing error messages or details.
3. Determine whether `partial` is dominated by an optional AI-generation failure vs collection/publishing failure, without reading sensitive error text.
4. Keep auto-retry and auto-republish disabled.
5. Production changes require a separately reviewed patch and explicit approval.

No DB writes, Cron changes, external provider collection, or production deployment.
