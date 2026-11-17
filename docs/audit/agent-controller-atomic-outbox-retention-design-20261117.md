# AI司令塔 — 永続化・通知Outbox・保存期間の事前仕様（2026-11-17）

Implemented offline-only contracts:
- `cron-monitor-atomic-store-contract.mjs`: sequential simulation of unique incident reservation. This **does not test real concurrent transactions** and is not an atomic database guarantee.
- `cron-monitor-notification-outbox.mjs`: notification intent with strict enumerated reason and three independent gates (approved destination, verified reservation, operator approval). Does not include destination, credentials, article data or arbitrary message text.
- `cron-monitor-retention-policy.mjs`: operator-review list for records older than a proposed 30-day retention, with legal hold. **Never deletes data.**

Proposed persistence:
- Append-only `attempt_events` with unique `event_id`, unique `attempt_id` for initial attempts, UTC event time, enum status, safe correlation ID and retention metadata.
- `incident_reservations` with unique `incident_key`, reservation state, lease/expiry, cooldown boundary, atomic compare-and-set or transaction, and crash recovery policy.
- `notification_outbox` with idempotency key, approved destination reference (not raw webhook), provider response/receipt ID, status transitions and operator-controlled delivery. No automatic retries.
- Only sanitized aggregate metadata; no secrets, raw article text, personal data or webhook URLs in logs.

Remaining implementation gates: choose persistence provider and data retention, design migration and rollback, demonstrate concurrent unique reservation under race and crash, enforce least privilege and RLS, configure authenticated notification sandbox and delivery receipts, budget and SQL timeout, and obtain explicit production deployment approval. No SQL migration, storage creation, real delivery, scheduler or production changes have occurred.
