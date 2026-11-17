# Agent Controller — offline snapshot-to-outbox integration (2026-11-17)

`cron-monitor-offline-pipeline.mjs` now composes the snapshot validation gate and worker-cycle planner into a single deterministic, offline-only decision path. Nine tests cover stale/unverified data, invalid incident identifiers, empty/healthy records, absent approval, synthetic lifecycle, and worker crash.

This is a **synthetic integration of pure functions**. It neither fetches production monitoring data nor writes an incident, nor authenticates an operator/provider, nor sends a notification. It returns `writeAllowed:false` and `sendAllowed:false` on all paths. The caller-supplied `incidentKey` and read-only flags are not independently verified.

**Before any live operation:** authenticate read-only data source; define incident identity and time-window semantics; connect transactional reservation/outbox persistence; integrate real lease/fencing and authenticated approval/receipt; verify RLS, performance, rollback and external provider sandbox; complete independent review and obtain explicit production authorization. PR #299 remains Draft and release HOLD.
