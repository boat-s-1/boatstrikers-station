# General NEWS partial-source outcome planner (2026-11-17)

Offline-only module `tools/agent-controller/cron-monitor-general-news-source-outcomes.mjs` records per-source outcomes for the three known sources `nikkan`, `macour`, `boatrace`.

- Each known source must occur exactly once; unknown/duplicate/missing sources and invalid counts/error categories fail closed as `HOLD`.
- Fulfilled sources retain their sanitized `found` count even when another source times out; rejected sources retain only bounded error category (`timeout`, `http_error`, `network_error`, `unknown`).
- Result is `HEALTHY` when all three fulfill, `DEGRADED` for one or more source failures; **all decisions forbid publication, retries and notifications**.
- This is an evidence planner, not a change to the live general-news sync. No fetch, insert, update, HTTP probe or retry.
- A separate, independently reviewed implementation and integration test is required before any production-side change to how errors are handled. This does not claim to solve the observed timeout.

Release HOLD.
