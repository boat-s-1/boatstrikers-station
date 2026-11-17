# Agent Controller — synthetic receipt persistence test (2026-11-17)

## Disposable PostgreSQL test
- Create a test-only receipt table with unique incident and unique provider receipt ID.
- Attempt to update outbox to `delivered` with a NULL receipt; CHECK/NOT NULL failure must rollback status change.
- Insert a synthetic receipt and update outbox to `delivered` in one transaction; verify both persist.
- Replay identical receipt; require a single receipt and no repeated state transition.

## Important distinction
This tests **atomic local persistence of a synthetic receipt**. It does not contact any delivery provider, validate authenticity of an external receipt, prevent duplicate messages at the provider, or prove end-to-end exactly-once delivery. The CI table is not production schema and no live notification occurs.

The production rollout remains HOLD until external sandbox delivery and verified provider idempotency, actual worker restart behavior, independent review, and explicit operator approval.
