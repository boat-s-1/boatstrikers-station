# 初音ニュース — Cron終了ログ欠落と記事作成時刻の照合 (2026-11-17)

## Method
Production Supabase read-only SQL. Window: rolling 21 days, `job_name='pipeline'`, completed eligibility `started_at < now()-3 minutes`. Each run's `started_at` through `started_at + 2 minutes` was joined to `public.hatsune_news.created_at`. Aggregates only; no article titles, bodies, IDs, raw logs or secrets were exported.

## Results
| Cron status | Runs | Windows with >=1 created article | Created articles in windows | Marked published in windows |
|---|---:|---:|---:|---:|
| running | 35 | 33 | 296 | 292 |
| partial | 28 | 26 | 133 | 131 |

Running windows: 2 with zero articles, 11 with 1–4, 8 with 5–9, 14 with >=10.
Partial windows: 2 with zero, 18 with 1–4, 3 with 5–9, 5 with >=10.

## Critical caveat
This is **temporal correlation**, not causal attribution. Other scheduled jobs or independent writers can create articles in the same window. The sum is a count of article rows matched to time windows, not a verified per-run insertion count. `is_published` reflects database state, not proof of public rendering or external notification.

## Operational conclusion
Do not automatically replay a `running` Cron or infer that no articles were produced. The absence of a completion log is insufficient evidence of zero side effects. Confirm source-key uniqueness, writer attribution, and delivery status before any reviewed manual replay.

## Next safe steps
- Review existing source-key uniqueness constraints and writer pathways without modifying them.
- Prototype an offline evidence reconciliation report with explicit `temporal_only` attribution.
- Investigate why certain windows contain 10+ articles and whether overlapping writers exist; avoid assuming these counts are solely pipeline output.

No production writes, external API requests, retries, or Cron changes.
