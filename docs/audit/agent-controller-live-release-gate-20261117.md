# Agent Controller — production release gate and remaining blockers (2026-11-17)

Added `cron-monitor-live-release-gate.mjs` and five offline tests. The gate lists 12 independent live-evidence requirements: authenticated monitoring source, read-only provenance, validated Cron status semantics, worker atomicity, lease fencing, authenticated operator, authenticated provider receipt, provider-side idempotency, unknown-delivery reconciliation, production-equivalent schema/RLS, independent security review, and explicit production approval.

Self-reported booleans and synthetic CI do not satisfy the gate. Even if all 12 evidence entries are presented, the pure function **always returns HOLD**: human authorization and a separate release mechanism are required. This is a fail-closed planning/validation component, not an installed deployment guard in Vercel/GitHub production workflows.

The GitHub isolated PostgreSQL tests verify synthetic behavior only. No production integration, real provider webhook, or authenticated operational worker exists in this PR. Draft PR #299 remains not release-ready. Do not merge or deploy without independent verification and explicit approval.
