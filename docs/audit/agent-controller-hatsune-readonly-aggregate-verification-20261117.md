# AI司令塔 — 読み取り専用集計SQLの実データ照合（2026-11-17）

Production Supabase was queried with the reviewed SELECT-only aggregate template, after a non-executing EXPLAIN review. No write statements or DDL were used.

Observation at 2026-11-17T08:41:40Z; window [2026-10-27T08:41:40Z, 2026-11-17T08:38:40Z).

| Field | Observed |
|---|---:|
| runs_total | 63 |
| running_without_finish | 34 |
| partial_runs | 29 |
| windows_with_articles | 58 |
| temporal_article_matches | 428 |

These counts match the prior read-only diagnostic's reported counts, but the rolling windows have different reference timestamps. Matching numbers are not proof of identical underlying rows or deterministic reproducibility. Article temporal matches are not causal attribution and do not prove delivery; a missing finish log is not proof that no articles were created.

The result conforms to the strict aggregate-only adapter's expected keys, with timezone-aware timestamps. The SQL itself was executed read-only; no live dashboard adapter or scheduled fetch was deployed. Query latency was not measured, and EXPLAIN without ANALYZE does not provide real execution cost. A future recurring deployment needs explicit review of credentials, query budget, access controls, monitoring and authorization.

No TRINITY provider access, Cron mutation, article replay, production schema change, deployment, or merge.
