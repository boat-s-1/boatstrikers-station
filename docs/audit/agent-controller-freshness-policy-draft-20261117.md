# AI司令塔 — 鮮度判定ポリシー (Draft, 2026-11-17)

- Service-specific `expected_max_age_hours` values are **operator-supplied**, never inferred from a single DB observation.
- This PR ships **no active thresholds** and **no schedules**. A suggested review is not a failure diagnosis.
- `discord_deliveries`: No sends may be expected on days with no matching alerts. Do not assume daily activity.
- `race_events`: Check race calendar and ingestion schedule before choosing a maximum age.
- `hatsune_news_cron_runs`: A single named Cron's history is not the status of all Cron jobs.
- TRINITY migration/provider restriction is intentionally outside this generic age policy; planned pauses stay planned pauses.
- Only enable a threshold after an operator confirms the expected update cadence and evidence source.
- No automatic alerts, restarts, retries, collectors, production DB writes or provider API calls are permitted in this phase.
