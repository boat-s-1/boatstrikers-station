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

## Function-level write-path audit (read-only, 2026-11-17)

This is a limited, **direct function-definition** audit using `pg_get_functiondef` and regex-derived identifiers; it does not execute any functions or reveal Cron command bodies.

| Entry point | Verified direct calls / referenced tables | Cutover implication |
|---|---|---|
| `bs_sync_openapi_today` (job 1) | Calls `bs_apply_openapi_results`, `bs_apply_openapi_preview`, `bs_apply_openapi_preview_events`; no textual call to `bs_apply_openapi_bootstrap` | Existing live sync does not visibly bootstrap programs |
| `bs_apply_openapi_bootstrap` | Writes `bs_race_events`, `bs_race_entries` | New candidate program bootstrap may trigger additional downstream behavior |
| `bs_apply_openapi_results` | Writes `bs_race_results`, `bs_race_entries`, `bs_race_events` | Shares tables with result backfill |
| `bs_backfill_missing_results` (jobs 21–23) | Directly references and writes `bs_race_results`, `bs_race_entries`, `bs_race_events` | **Confirmed same-table writer**, requires source-priority and concurrency plan |
| `bsc_refresh_official_performance` (job 20) | Calls `bsc_capture_official_rankings`, `bsc_settle_official_predictions`, `bsc_sync_official_results_to_legacy` | Mostly separate result/forecast flow, but settlement reads `bs_race_results`; do not disable without dependency analysis |
| `bsc_sync_official_results_to_legacy` | Writes `bsc_results` (and references `bsc_official_predictions`/`bsc_official_results`) | Not established as a direct `bs_race_*` writer |
| `bsc_settle_official_predictions` | Reads `bs_race_results`, writes settlement tables | Consumer dependency; ensure cutover does not change results unexpectedly |
| `refresh_ichika_validation_history` (job 19) | Reads `bs_race_results` and updates its own validation state | Consumer; not a candidate for indiscriminate shutdown |
| `bs_record_race_data_completeness` (job 24) | Updates quality/completeness tables and logs | Consumer/monitor; preserve where safe |

The result backfill's direct definition has no textual `pg_advisory` call. The proposed atomic candidate's lock alone **cannot** coordinate with this independently scheduled backfill.

### Required next checks

1. Inspect the exact update predicates and source precedence of `bs_backfill_missing_results`, including whether it can overwrite an already confirmed race and whether it processes only the prior JST date.
2. Trace nested functions and triggers for indirect writes; catalog external writers (Windows, Vercel, manual API) separately.
3. Determine whether the new **current-JST-date-only** candidate and previous-day backfill can operate on disjoint dates without touching shared derived tables or notifications. Do not assume safety from different nominal schedules.
4. Test a same-race conflicting result with legacy backfill in a disposable clone, plus two concurrent transactions, before any real cutover.
5. Keep jobs 19, 20 and 24 active unless a specific, tested dependency requires a narrowly scoped pause.

**Decision: HOLD.** These findings refine the writer inventory but do not authorize pausing production Cron.

### Backfill predicate screening

A read-only textual screen of the live `bs_backfill_missing_results` definition confirms it contains `ON CONFLICT`, `result_status`, `confirmed`, `COALESCE`, `api_result_source`, and `synced_at`, but no textual `pg_advisory`. **Keyword presence does not establish that a confirmed result is immutable** or that source priority is correct. Exact assignment/predicate review and a conflict fixture remain required.
