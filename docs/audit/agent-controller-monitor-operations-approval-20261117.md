# AI司令塔 — 本番監視導入の運用準備と承認待ち事項（2026-11-17）

## Prepared, not deployed
Offline modules: `cron-monitor-config.mjs` (strict configuration), `cron-monitor-audit-envelope.mjs` (safe audit envelope), `cron-monitor-kill-switch.mjs` (fail-closed operator stop). Tests cover safe defaults, missing approvals, invalid values, forbidden sensitive fields, and no production effects.

## Proposed operating profile (not enabled)
- Poll at most once per 60 minutes; no retries or backfill.
- Read-only aggregate query; 21-day window, excludes last 3 minutes, single output row.
- 5-second SQL timeout **proposal** and 15-minute freshness gate; actual database-level timeout not yet installed.
- Notification channel disabled until explicitly selected, authenticated and receipt-tested.
- Daily budget must be explicitly specified (offline validator caps proposed value at USD 5/day, **not** an actual billing control).
- Fail closed on missing read-only credentials, verified origin, durable ledger, atomic reservation, delivery receipt, operator approval or kill switch.
- No TRINITY collector restart, provider API calls, article replay or writes to production.

## Data model proposal, NOT migration
A durable append-only event stream should have unique event_id, unique attempt_id for attempt records, correlation_id, event timestamp, enumerated kind/state/code and a retention policy. Notification reservations require atomic uniqueness on incident key and a transactional cooldown check. Delivery receipts must be independently obtained from the selected provider; an internal event labeled 'delivered' is not proof. Avoid raw article content, tokens, SQL strings, personal data and webhooks in logs.

## Operator procedure
1. **Before activation:** review Draft PR, confirm read-only role, SQL performance, budget, notification destination, receipt semantics, append-only storage and unique reservation, rollback owner and maintenance window.
2. **Dry run:** offline synthetic scenarios, permission-denied and timeout injection, duplicate reservation race test, stale evidence test and notification sandbox test with explicit permission.
3. **Activate (separate approval):** release a minimal read-only poller with a kill switch and no retry/replay; begin with manual observation before scheduling.
4. **During incident:** record sanitized attempt outcome, propose at most one atomic reservation, notify only after cooldown, require human investigation; no automatic repair.
5. **Stop:** disable scheduler and notifier through verified kill switch; leave existing records intact for audit; never restart restricted collectors.
6. **Recovery:** three consecutive authenticated healthy observations followed by operator close review.

## Explicit user choices still needed
- Notification channel and authorized destination (Discord or email), and whether notification delivery may be tested.
- Whether hourly monitoring is acceptable, and daily cost ceiling.
- Explicit production read-only monitoring deployment approval and rollback responsibility.
- Persistence location and retention period for audit records.

The new modules always report `effective_enabled=false`; no production integration, schedule, notifications, schema migration or billing controls were changed.
