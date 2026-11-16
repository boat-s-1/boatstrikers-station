# PR #298 — daily completeness zero-race blind spot (read-only)

## Production evidence on 2026-11-17

Read-only queries against project `rzosrbkyniyedolhkgxo` show:

| Race date | Collector `live_all` success attempts | Results | Base events | Base entries | Daily completeness | Scanned races | Issue count |
|---|---:|---:|---:|---:|---|---:|---:|
| 2026-11-11 | 310 | 144 | 144 | 864 | success | 144 | 0 |
| 2026-11-12 | 310 | 155 | 156 | 936 | partial | 156 | 1 |
| 2026-11-13 | 310 | 156 | 0 | 0 | partial | 0 | 0 |
| 2026-11-14 | 310 | 168 | 0 | 0 | partial | 0 | 0 |
| 2026-11-15 | 310 | 156 | 0 | 0 | partial | 0 | 0 |
| 2026-11-16 | 310 | 120 | 0 | 0 | partial | 0 | 0 |

These counts are actual persisted rows and log records, **not** the count of unique races fetched by the collector. `live_all` marks its preview/result RPC sequence as successful, not base-row completeness. The daily check's `partial` status is not a success, but its `issues=[]` and `issue_count=0` can obscure a complete base-table gap.

The read-only audit query in `DAILY-COMPLETENESS-BLINDSPOT-READONLY-20261117.sql` compares result rows to event/entry rows and explicitly flags 11/13–16 as `CRITICAL`. A day with zero results and zero base rows is `UNKNOWN`, not automatically complete; compare against the official schedule.

## Proposed release gate

- Distinguish `collector_executed`, `source_fetched`, `base_events_complete`, `six_boat_entries_complete`, `results_complete`, and `official_schedule_parity`.
- Raise a separate **base-row absence alert** when results exist but event rows are zero. Do not rely on `issue_count` alone.
- Include a zero-race check even when the daily completeness query finds no base events.
- Do not interpret 310 successful `live_all` calls as proof of 310 complete data snapshots.
- The existing daily completeness function and production cron were **not** modified. This is a diagnosis and SQL audit only.

## Unresolved

Determine whether the prior independent base-row collector was Windows-dependent, when it stopped, and whether any official schedule or deployment change occurred. Backfill and automated remediation require separate approvals and isolated-DB verification.
