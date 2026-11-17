# AI司令塔 — 初音ニュースSQL実行負荷の事前調査（2026-11-17）

Read-only PostgreSQL catalog inspection of production (no data mutations) showed:
- `hatsune_news`: estimated 1,626 live tuples; relation 3,128 kB, total 3,760 kB.
- `hatsune_news_cron_runs`: estimated 245 live tuples; relation 168 kB, total 376 kB.
- Cron runs have a `started_at DESC` index.
- News articles have indexes on `category,published_at`, `collected_at`, `source_key`, public feed fields and PK; **no dedicated `created_at` index**.

The earlier per-run scalar article-count query could repeatedly scan article rows. The offline SQL template was revised to materialize bounded article timestamps once, then join to bounded run windows. This limits repeated scans but does not guarantee index use or a low-cost execution plan. Internal run IDs are used solely to group and are not returned in output. Temporal matches may overlap and remain non-causal.

**Hold for production execution:** review `EXPLAIN` (without `ANALYZE`) and statement timeout under an approved read-only session, confirm exact column types and query cost, and assess whether a narrowly scoped index would eventually be useful. Any index creation would be a separate production change requiring explicit approval. The template has not been executed against production in this step.

Static SQL contract tests verify structure and forbid mutation keywords, but do not prove SQL correctness, query planning or authorization.
