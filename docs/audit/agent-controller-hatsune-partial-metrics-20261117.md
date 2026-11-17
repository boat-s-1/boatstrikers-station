# 初音ニュースCron — partial エラー件数と実処理の分離 (2026-11-17)

Read-only aggregates from `public.hatsune_news_cron_runs` over the rolling last 21 days:

| status | error_count | runs | with inserted_count > 0 | with ai_generated_count > 0 |
|---|---:|---:|---:|---:|
| partial | 1 | 25 | 23 | 25 |
| partial | 2 | 2 | 2 | 2 |
| partial | 3 | 1 | 1 | 1 |
| running | 0 | 35 | 0 | 0 |

Across 28 `partial` runs: 133 inserted_count total, 108 ai_generated_count total, and 26 runs with inserted_count>0. This is **application-reported metrics**, not independent proof of individual publication.

## Safe conclusions
- All `partial` rows recorded some AI generation despite errors.
- Most partial runs have a single error (25/28). Error category is not yet known.
- `running` metrics remain default zero because the completion update did not persist; no inference about actual side effects is justified.
- Do not auto-retry or republish; keep end-to-end health unverified.
- Investigate error categories via safe aggregate classification only after reviewing classification for possible sensitive strings.

No error_message/details values or personal data were retrieved; no production changes.
