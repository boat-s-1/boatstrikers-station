# Agent Controller: isolated claim ownership validation (2026-11-17)

The disposable PostgreSQL CI suite now includes a competing claim test:
1. Two concurrent connections attempt to claim the same approved outbox row using conditional UPDATE.
2. The first connection holds its transaction open while the second waits.
3. The final claim token must remain the first claimant's.
4. A stale token cannot release a claim it does not own.
5. The matching owner can release its own claim.

This tests PostgreSQL conditional UPDATE serialization and basic token ownership only. It is **not** a production lease protocol: there is no expiration, heartbeat, monotonic fencing counter, real worker, notification send, receipt persistence, or external provider. A production implementation must not infer that a token string alone guarantees safe failover.

CI target is strictly `127.0.0.1` and database `agent_controller_ci`. No production changes, no real notifications. Keep PR Draft and deployment HOLD.
