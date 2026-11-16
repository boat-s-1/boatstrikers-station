# AI司令塔 読み取り専用DB観測 (2026-11-17)
This is a one-time human-initiated read-only SQL inspection, **not** a deployed or scheduled monitoring connection.

## Confirmed aggregate observations (UTC)
| source | rows | latest recorded timestamp | interpretation |
| --- | ---: | --- | --- |
| public.bs_discord_notification_deliveries (sent_at) | 3921 | 2026-11-12 11:25:04.857+00 | latest delivery record only; no Discord API verification |
| public.bs_race_events (updated_at) | 70776 | 2026-11-12 14:27:00.1018+00 | latest row update only; not proof of missing scheduled races |
| public.hatsune_news_cron_runs (created_at) | 243 | 2026-11-16 13:00:06.92196+00 | one specific cron run log, not all Cron jobs |

No secrets, user identifiers, Discord message contents, or row-level data were retrieved.
All three results are **observations, not health verdicts**. Do not mark any service as healthy or broken from these aggregates alone.

## SQL used
```sql
SELECT 'discord_deliveries' AS source, count(*)::bigint AS rows_total,
       max(sent_at)::text AS latest_observed_at
FROM public.bs_discord_notification_deliveries
UNION ALL
SELECT 'race_events', count(*)::bigint, max(updated_at)::text
FROM public.bs_race_events
UNION ALL
SELECT 'hatsune_news_cron_runs', count(*)::bigint, max(created_at)::text
FROM public.hatsune_news_cron_runs;
```

## Guardrails
- No write SQL, no API collector calls, no Discord sends, no schedule changes.
- Do not assume `hatsune_news_cron_runs` covers all Cron jobs.
- TRINITY migration/provider-restricted pauses remain planned pauses.
- For automated cloud reads, design least-privilege credentials and scoped views **before** any deployment.
