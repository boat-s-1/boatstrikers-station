# AI司令塔 — Cron統合診断レポート v1（隔離試作、2026-11-17）

`tools/agent-controller/cron-diagnostic-report.mjs` combines three existing pure offline modules: stage telemetry normalization, request timing reconciliation, and completion/log reconciliation. Seventeen offline tests cover ambiguous evidence, logging failures, deadline proximity, and no replay.

## Output
The report provides a sanitized run key, stage observations, timing assessment, completion/log assessment, a list of investigation issues, and a conservative Japanese display state. Priority issues include `completion_log_problem`, `stage_failure`, `deadline_review`, `limited_headroom`, `timing_evidence_incomplete`, `completion_unknown`.

All outputs set `evidence_provenance='caller_supplied'`, `actual_delivery_verified=false`, `automatic_retry_allowed=false`, `automatic_republish_allowed=false`, `production_health='unknown'`.

## Scope and limitations
This is a deterministic offline report builder, not a web dashboard, a deployed agent, or live telemetry. It cannot independently verify caller evidence. It does not infer a successful delivery from a completed log, nor infer absence of side effects from missing logs. Request duration and stage durations are hypothetical or externally measured, and must represent non-overlapping sequential stage timing. It does not run SQL, contact provider APIs, change Cron, send notifications or replay jobs.

## Next gate
Create a synthetic fixture for representative running/partial/timeout cases, validate the report in GitHub Actions, then design a read-only authenticated evidence adapter. Production integration and any changes to live code require separate review and approval.
