# Notification outbox crash/replay — fail-closed model (2026-11-17)

## Verified in disposable PostgreSQL
GitHub Actions run [44060239922](https://github.com/boat-s-1/boatstrikers-station/actions/runs/44060239922) passed: termination of a backend with an uncommitted reservation rolled back the transaction; subsequent retries created one reservation. This is database behavior, **not application restart or notification-provider behavior**.

## Offline model added
`cron-monitor-outbox-recovery-simulator.mjs` and tests model:
- Pending review -> explicit approval -> in-flight -> provider accepted/rejected.
- Worker crash while in-flight -> `delivery_unknown`; no automatic retry, manual reconciliation required.
- Provider rejection -> failed -> renewed review; no implicit resend.
- A delivered item cannot be delivered again in the model.

## Important limit
An external provider may have accepted a message just before the worker crashed. Without provider-side idempotency and an authenticated persisted receipt, an exactly-once guarantee is **not established**. The model performs no network calls, sends no notifications, persists no receipt, and authorizes no production delivery.

## Next checks
- Integrate a durable transactional outbox with lease fencing and explicit delivery receipts in a separately approved isolated environment.
- Test crash before and after provider acceptance with an instrumented sandbox endpoint.
- Independently review delivery destination, credentials, retention, query latency, and deployment rollback before production approval.
