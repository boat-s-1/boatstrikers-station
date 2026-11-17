# Agent Controller — synthetic signature → isolated DB integration (2026-11-17)

Added `isolated-node-signed-receipt-ci.mjs` to the disposable PostgreSQL CI job after the receipt-required transition trigger is installed.

The Node process constructs a fixed synthetic HMAC-SHA256 envelope. An invalid signature returns HOLD, leaving the outbox `in_flight` with zero receipts. The valid signed fixture is checked and the **CI harness only** inserts a synthetic receipt and transitions to `delivered` in a single local PostgreSQL transaction. Replaying the receipt leaves exactly one row.

This demonstrates a limited cross-layer test path, **not an authorized delivery worker**. The pure verifier always returns `writeAllowed:false`; the test harness has separate hardcoded CI-only write authority. Real provider identity, secret rotation, authenticated human approval, request replay nonce, and production deployment are not implemented. No real provider traffic or production DB access. Release HOLD.
