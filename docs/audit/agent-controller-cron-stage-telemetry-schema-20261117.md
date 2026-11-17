# 初音ニュース — 工程別時間計測データ形式（隔離試作、2026-11-17）

## New offline schema
`tools/agent-controller/cron-stage-telemetry-schema.mjs` normalizes explicitly supplied stage observations. Supported stages in pipeline order: collection, media, general, optional fallback, optional AI, finish_log. Each stage carries an outcome (completed/failed/skipped_deadline/unknown) and durationMs (nonnegative integer or null). Unknown durations stay unknown; a skipped stage must report zero elapsed stage time.

Outputs include schema_version=1, a non-sensitive run key, per-stage durations, known sum, count of unknown durations, finish-log observation flag, and runtime cap. A sum under 60s **does not prove** request-level runtime was under 60s: authentication, start logging, gaps, response serialization, scheduling and platform overhead are not included. The schema deliberately does not invent a wall-clock duration or claim production health.

## Future measurement proposal — not deployed
Measure each stage with a monotonic clock inside an isolated integration test. Persist only allowlisted stage names, duration integers and sanitized status codes; never secrets, URLs, article contents or raw error strings. Include auth/start-log overhead, completion-log attempt and response serialization in an independent request-level budget. Validate whether finish-log writes report exact affected-row identity. Compare request-level deadline with stage-level sums and handle missing telemetry conservatively.

## Safety
16 offline tests. No production instrumentation, database writes, Cron changes, API requests, automatic retries, or deployment.
