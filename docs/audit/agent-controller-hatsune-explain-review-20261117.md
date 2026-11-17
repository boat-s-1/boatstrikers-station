# AI司令塔 — 初音ニュースSQL実行計画とテスト修正（2026-11-17）

Read-only production `EXPLAIN (COSTS ON, FORMAT TEXT)` was run for the aggregate core, **without ANALYZE** and without executing the article aggregation.

- Estimated top-level planner cost: 586.62..586.63 (arbitrary planner units, not milliseconds).
- `hatsune_news_cron_runs`: Index Scan using `hatsune_news_cron_runs_started_idx` on `started_at`; estimated 27 rows after filter.
- `hatsune_news`: Seq Scan; estimated 1,649 rows, then bounded time filter, because there is no `created_at` index.
- Materialized article CTE estimated 183 rows; join cardinality and actual latency remain unverified.
- This does not demonstrate production query runtime, peak memory, lock behavior or execution safety.

**Test failure and fix:** The first revised SQL test rejected all occurrences of internal `r.id`, although IDs are required for correct per-run grouping and are not exported. Actions run 44048509184 reported 356 pass, 1 fail. The test was corrected to inspect only the final SELECT projection, where raw identifiers must not appear. A new Actions result is required before claiming the fix passes.

No index creation, table changes, production SQL aggregation, Cron edits, notifications or deploys were performed. A future index or production execution requires a separate review and approval.
