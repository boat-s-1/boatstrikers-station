# Agent Controller — Node DB reconciliation evidence (2026-11-17)

Extended the disposable PostgreSQL Node adapter test to cover a synthetic delivery reconciliation after a worker-loss state:

1. The outbox enters `delivery_unknown` after `in_flight`.
2. A stale conditional update cannot mark it delivered and no receipt exists.
3. A **synthetic receipt** and the `delivery_unknown → delivered` transition are committed in one PostgreSQL transaction.
4. Replaying the same receipt leaves one receipt record; the delivered outbox cannot be claimed again.

This is a DB transaction and replay test, **not proof that an actual provider receipt is authenticated**. The isolated DB trigger currently validates transition shape but does not independently require a receipt or authorized operator, and no provider-side idempotency has been tested. Do not use this to enable real notifications. Deployment HOLD.
