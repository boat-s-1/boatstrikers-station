# Agent Controller — synthetic DB lifecycle integration (2026-11-17)

## Added integration
The disposable PostgreSQL CI now runs a single DB-only lifecycle:
1. Atomically reserve an incident and create its pending-review outbox row.
2. Apply a **synthetic** approval state (not a real operator authorization).
3. Insert a **synthetic** provider receipt and mark the outbox delivered in one transaction.
4. Replay the incident, outbox and receipt writes; require exactly one row of each and delivered state unchanged.

This is a PostgreSQL integration test with synthetic data, **not a running application worker** and not a real delivery. No network endpoint, notification provider, real approval, credentials, or production tables are used.

## Remaining blockers
- Integrate real read-only monitoring source and durable state transitions with production-compatible schema in a separately approved isolated environment.
- Instrumented delivery sandbox with receipt authenticity and provider idempotency.
- Restart/reconciliation behavior, retention and latency measurements, independent security review.
- Explicit production authorization. Deployment remains HOLD; PR remains Draft.
