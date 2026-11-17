# PR #298 — Production Cron cutover inventory (read-only)

Audit date: 2026-11-17. No production changes. This file intentionally contains **no Cron command bodies, credentials, URLs with tokens, or environment values**.

## Relevant active schedules

The following were identified from production `cron.job` by querying only `jobid`, `jobname`, `schedule`, `active`, and a derived classification; all listed jobs were active at audit time.

| jobid | jobname | schedule (stored cron expression) | provisional classification |
|---:|---|---|---|
| 1 | boatstrikers-openapi-live-3m | `*/3 23,0-14 * * *` | OpenAPI sync |
| 20 | bsc-official-performance-refresh | `15 0-14,22-23 * * *` | performance refresh, potential writer |
| 21 | boatstrikers-previous-results-0010-jst | `10 15 * * *` | previous-day results backfill |
| 22 | boatstrikers-previous-results-0030-jst | `30 15 * * *` | previous-day results backfill |
| 23 | boatstrikers-previous-results-0100-jst | `0 16 * * *` | previous-day results backfill |
| 19 | ichika-validation-daily | `50 15 * * *` | downstream validation |
| 24 | boatstrikers-data-completeness-0110-jst | `10 16 * * *` | downstream completeness |

The `schedule` column is the raw PostgreSQL cron expression; verify actual scheduler timezone before translating to JST. This list is **not a complete inventory of all writers**: Vercel endpoints, manual scripts, Windows sync, other SQL functions, triggers, and other Cron tasks may write indirectly.

## Cutover gates

1. Trace direct and transitive table writes for jobs 1, 20–23, and API/Windows ingestion. In particular, determine whether `bsc_refresh_official_performance` touches the same race tables.
2. Capture safe run history (job IDs, status, start/end times, errors **redacted**) and verify no in-flight legacy ingestion.
3. Plan a bounded maintenance window with explicit approval to disable only the exact legacy writer jobs that are proven conflicting. Do **not** stop downstream monitoring or unrelated jobs by default.
4. Validate the new candidate on isolated data, compare data counts and result immutability, then explicitly authorize activation. A production dry-run must not write.
5. Specify a rollback sequence restoring the original schedules without allowing both old and new writers to overlap. Preserve original job IDs and schedule expressions in a secure runbook.
6. Ensure credentials are not embedded in Cron command text; audit credential handling and rotate any exposed secrets under a separate approved security change.

## Security observation

During read-only inspection, some unrelated `cron.job.command` definitions contained literal authentication material. **No values are copied here or to GitHub.** Treat this as a credential hygiene concern requiring a scoped, approved audit and possible rotation; do not modify jobs or credentials as part of this documentation-only work.

## Current decision

**HOLD**: the candidate advisory lock is not shared by the inspected legacy writer definitions. No disabling jobs, changing Cron, DB migrations, Vercel, Windows or paid resources without explicit separate approval. The existing strict fail-closed design remains in force.
