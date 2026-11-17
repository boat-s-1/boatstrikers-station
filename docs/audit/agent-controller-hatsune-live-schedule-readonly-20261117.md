# Hatsune NEWS — verified read-only scheduler discovery (2026-11-17)

Read-only inspection of production Supabase project `rzosrbkyniyedolhkgxo`, using `cron.job` and `cron.job_run_details`. No scheduler or production data changed.

| Job ID | Job name | UTC cron | JST expected time | Active | Attempts in prior 7 days | Most recent scheduler result |
| --- | --- | --- | --- | --- | --- | --- |
| 8 | hatsune-news-1000-jst | `0 1 * * *` | 10:00 | true | 7 | succeeded |
| 9 | hatsune-news-1400-jst | `0 5 * * *` | 14:00 | true | 7 | succeeded |
| 10 | hatsune-news-2200-jst | `0 13 * * *` | 22:00 | true | 7 | succeeded |

Last starts observed 2026-11-17 01:00, 05:00, 13:00 UTC respectively.

The scheduled jobs use `net.http_get` to invoke the Hatsune NEWS pipeline route. The SQL command includes a dynamic scheduler credential lookup; **do not copy the SQL command or any credential into logs, documentation, fixtures or reports**. The job names/schedules and aggregate run statuses are sufficient for this report.

**Important evidence boundary:** `cron.job_run_details.status = 'succeeded'` indicates that the scheduled SQL invocation completed successfully; it does not establish that the asynchronous HTTP request succeeded or that the downstream Next.js handler generated news. This requires separately correlating sanitized HTTP response evidence, app run records and article output. The handler has a 60-second maximum duration, whereas the `net.http_get` request uses a 120-second timeout. These are not equivalent end-to-end success guarantees.

No automatic retry, notification, or remediation should be authorized on the basis of Cron scheduler status alone. This is source plus live scheduler metadata evidence, not end-to-end production verification. Release HOLD.
