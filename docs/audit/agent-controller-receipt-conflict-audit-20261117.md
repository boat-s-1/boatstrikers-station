# Agent Controller — conflicting receipt audit persistence (2026-11-17)

The disposable PostgreSQL CI job now exercises `isolated-postgres-replay-audit-ci.sh` after replay classification. A test-only `receipt_conflict_audit_ci` table records an audit row for each conflicting replay (changed digest or reused identity), while an identical replay is classified without a conflict audit. The test asserts three conflict audit rows and that the original receipt ledger still has one row.

The function does not store raw provider payloads or secrets. It is **CI-only**, with synthetic IDs and digest labels, not cryptographic hashes. This is not an immutable/tamper-proof audit store, nor an independent security review. It does not authenticate provider traffic, enforce concurrency correctness under simultaneous conflicting calls, or automatically notify an operator. Production release remains HOLD.
