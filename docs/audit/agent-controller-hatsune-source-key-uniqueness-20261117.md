# 初音ニュース — 重複登録防止の実装とDB制約監査 (2026-11-17)

## Read-only production observations
- `public.hatsune_news` has unique index `hatsune_news_source_key_uidx` on `source_key`. PostgreSQL unique indexes allow multiple NULL values unless configured otherwise.
- Aggregate: 1,626 rows, 4 NULL source keys, zero empty-string source keys, 1,622 distinct non-NULL keys. In the last rolling 21 days, 428 articles, zero NULL source keys.
- The repository migration `supabase/migrations/20260825_hatsune_news_auto_collection.sql` defines a partial unique index `WHERE source_key IS NOT NULL`. Production `pg_indexes.indexdef` reports a unique index without the WHERE predicate. Both enforce uniqueness for non-NULL keys; the exact difference should be reconciled before migration changes.

## Read-only code review
`lib/boatstrikersGeneralNewsSync.js` builds general-news keys as `general:<source>:<URL>`. It deduplicates candidate titles in memory, prechecks existing source keys and titles with separate SELECTs, then calls `.insert(enrichedRows)`. The SELECT-before-INSERT is not atomic and is not a guarantee against concurrent title duplicates. DB unique index rejects duplicate non-NULL source keys even if two concurrent runs both pass the precheck. Rejection may abort a batch; there is no observed conflict-specific recovery in this function. Source URLs with different representations can produce different source keys for the same story; title uniqueness is not backed by a unique index.

## Safety conclusion
- Same non-NULL source key: database uniqueness protection exists.
- NULL source key: this index does not provide protection.
- Same title/different source key: no demonstrated DB-level uniqueness protection.
- Simultaneous insertion: source-key conflict is possible; do not interpret it as a confirmed duplicate or automatically replay the entire batch.
- These findings do **not** justify replaying any stranded `running` job.

## Offline implementation
Added `news-duplicate-protection.mjs` and 10 tests, explicitly separating source-key protection from title and concurrency guarantees.

No production writes, Cron changes, external fetches, retries, deployment or merge.
