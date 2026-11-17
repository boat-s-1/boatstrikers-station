# 初音ニュース — リクエスト時間と工程別時間の照合（隔離試作、2026-11-17）

`tools/agent-controller/cron-request-timing-reconciliation.mjs` reconciles externally supplied request elapsed time against the sum of known sequential stage durations. Its `unaccounted_elapsed_ms` represents time not covered by supplied stage durations (for example auth, start-log, serialization, scheduling and instrumentation overhead), **not** a measured breakdown of those causes.

## Conservative assessments
- `missing_request_timing`: no request-level duration supplied.
- `incomplete_stage_coverage`: request time available, but at least one stage duration unknown.
- `limited_headroom`: request time within 8 seconds of hypothetical 60-second limit.
- `reported_limit_reached`: supplied duration >= limit, not independent proof of a Vercel timeout.
- `reported_within_budget`: supplied duration below warning threshold with no explicitly unknown stage durations; does not prove actual health.

Inconsistent input where known stage time exceeds request elapsed time is rejected. Every result disables automatic retry and reports end-to-end health unknown.

## Limitations
The module does not collect live timings, does not identify which overhead category caused delay, and does not prove that missing telemetry implies zero work. Stage durations must be sequential and non-overlapping for subtraction to be meaningful. The live route remains unchanged.

15 offline tests. No production changes, Cron edits, deployments, provider API requests, or replay.
