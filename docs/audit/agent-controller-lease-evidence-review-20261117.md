# AI司令塔 — 同時実行・通知不確実性・証跡の安全設計（2026-11-17）

## Implemented offline
- `cron-monitor-lease-policy.mjs`: an unreserved incident may only **propose** an atomic claim. Active reservations, delivered/failed states and expired leases default to HOLD. Expired leases are **not** automatically reclaimed: a crash may have happened after provider delivery but before receipt persistence. Even operator override only proposes manual takeover review.
- `cron-monitor-evidence-chain.mjs`: SHA-256 chain for sanitized records. Detects local tampering/reordering when the expected head hash is trusted. Does **not** authenticate event origin, prove immutable storage or prevent a malicious actor from replacing both records and head.
- 28 offline tests across lease and chain modules.

## Remaining real-world verification
1. Execute transactional duplicate reservation race tests on an **approved isolated** database, including process crashes and lease expiry; no production writes.
2. Independently anchor signed chain head to a trusted storage location and verify append-only permissions; decide retention and key rotation.
3. Test notifier in an authorized sandbox with provider delivery receipts, duplicate delivery suppression, network timeout and receipt persistence failure.
4. Confirm least-privilege SQL credentials, read-only resource limits, statement timeout, billing guardrails and rollback.
5. Obtain explicit production deployment and notification approval. PR #299 stays Draft.

## Stop boundary
No database writes, no scheduler, no external sends, no restricted provider calls, no TRINITY collector restart and no automatic article replay. These are simulation and policy components only.
