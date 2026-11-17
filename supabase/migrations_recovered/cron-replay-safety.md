# Production Cron replay-safety review

Date: 2026-11-18
Scope: read-only comparison of nine recovered migration payloads containing Cron scheduling markers against the current production `cron.job` registry.

## Current production state

- 24 Cron jobs were present.
- All 24 were active at inspection time.
- The current schedules are live operational configuration and must not be overwritten by replaying historical migrations.

## Replay hazards identified

| Recovered migration | Hazard |
|---|---|
| `schedule_openapi_live_sync` | Schedules `boatstrikers-openapi-live-3m` at every three minutes without the current hour window. Replaying can change production cadence. |
| `boat4_double_top_alerts` | Unschedules the named production job and schedules it every minute, broader than the current restricted schedule. |
| `schedule_ichika_hidden_escape_line` | Builds a new job command by reading `cron.job` using hard-coded job ID 3. Job IDs are environment-specific. |
| `schedule_hatsune_womens_inner_break_line` | Copies and rewrites another live job command; behavior depends on the source job existing and matching expectations. |
| `schedule_engine_v3_weekly` | Replaces the named weekly job. |
| `engine_v3_cron_no_timeout` | Replaces the same weekly job again, with a different command body and timeout behavior. |
| `schedule_ichika_escape_surge_line_cron` | Reads a source command by hard-coded job ID 4 and conditionally creates another job. Job IDs are environment-specific. |
| `automate_official_performance_sync` | Runs `bsc_sync_official_results_to_legacy()` immediately and schedules recurring work; the function writes to the legacy results table. |
| `restore_results_and_harden_daily_sync` | Alters job ID 1, unschedules named jobs, and creates multiple recurring jobs. It also defines a backfill function capable of inserting missing race results. |

## Live authentication material

A read-only metadata scan found authentication-header/token literals in current production Cron command definitions. These values were not copied into this branch, manifest, or report, and are intentionally not reproduced here. The recovered SQL archive itself had no matches for the high-confidence credential patterns screened earlier.

Treat live Cron command text as sensitive. A separate controlled review should determine whether any literal credentials should be rotated and moved to a managed secret store. No rotation or Cron command changes were performed.

## Decision

**HOLD — do not replay the Cron-related migrations against production.**

For an isolated test:
1. create a disposable database with no production Cron jobs or credentials;
2. replace all external HTTP targets with inert test endpoints or disable those jobs;
3. remove assumptions about fixed `jobid` values by mapping source jobs by stable names;
4. assert expected job names and schedules after each migration;
5. keep the immediate legacy sync and result backfill functions disabled until explicitly tested against disposable data.

This report is a safety review, not authorization to change production Cron configuration.
