# AI司令塔 — 直近21日分の更新頻度調査 (2026-11-17)

One-time read-only aggregate SQL on production Supabase project `rzosrbkyniyedolhkgxo`. No row contents, identities or credentials were requested.

| source | records within rolling 21 days | distinct JST dates with records | first active JST day | last active JST day |
|---|---:|---:|---|---|
| bs_discord_notification_deliveries.sent_at | 426 | 14 | 2026-10-30 | 2026-11-12 |
| bs_race_events.updated_at | 2496 | 17 | 2026-10-27 | 2026-11-12 |
| hatsune_news_cron_runs.created_at | 63 | 21 | 2026-10-27 | 2026-11-16 |

For `hatsune_news_cron_runs`, the last 21 days contain status values `running` (35 rows) and `partial` (28 rows). **These labels cannot be interpreted as success or failure without reviewing the application's status semantics.** The `running` label may be an intermediate persisted state; `partial` may represent expected or degraded operation.

## Interpretation
- Observed active days are not the same as expected active days.
- No automatic threshold can be justified from this data alone. All per-service freshness policies remain disabled.
- Discord delivery records do not establish Discord gateway/API connectivity.
- Race event update times are not a substitute for the race schedule.
- This one Cron table is not a full inventory of scheduled jobs.
- The current TRINITY planned pause remains excluded from failure detection.

## Follow-up evidence before enabling any policy
1. Document actual expected schedule, quiet periods, and acceptable delay per source.
2. Inspect (read-only) how Cron status `running` and `partial` are assigned.
3. Determine whether record creation is event-driven or schedule-driven.
4. Add explicit manual approval before enabling thresholds or notifications.

No production writes, Discord posts, API collection, automatic repairs, or Cron changes.
