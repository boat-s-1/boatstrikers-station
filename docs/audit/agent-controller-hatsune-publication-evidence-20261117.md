# 初音ニュース — 実記事保存とCronログの独立照合 (2026-11-17)

Read-only aggregate queries on production `public.hatsune_news`:
- Total rows: 1,623.
- Created within rolling 21 days: 432; of these, `is_published=true`: 425.
- Created within rolling 7 days: 147.
- Latest `created_at`: 2026-11-16 13:00:35.305731+00 (22:00:35 JST).
- Latest `updated_at`: same timestamp.
- Latest `published_at` value: 2026-11-16 13:00:30.815+00.

Per JST day within the last rolling seven days:
| JST date | created | is_published=true |
|---|---:|---:|
| Nov 10 | 29 | 29 |
| Nov 11 | 20 | 20 |
| Nov 12 | 23 | 23 |
| Nov 13 | 20 | 20 |
| Nov 14 | 23 | 22 |
| Nov 15 | 16 | 16 |
| Nov 16 | 16 | 16 |

**Important:** Despite no `success` status in 63 pipeline log rows, new news records exist and are marked published. Do not conclude the news system has fully stopped. These aggregate records do not establish which process created each item, whether it was successfully rendered to end users, or whether any specific upstream source succeeded.

## Diagnostic priority
1. Inspect the meaning and distribution of `partial` errors using non-sensitive aggregate counts, not error_message/details contents.
2. Verify a safe, read-only user-facing feed response or render if authorized.
3. Keep business-operation retries disabled; investigate stranded `running` log records separately.
4. Never treat `is_published` as proof of public page accessibility.

No production writes, publication changes, or Cron schedule changes.
