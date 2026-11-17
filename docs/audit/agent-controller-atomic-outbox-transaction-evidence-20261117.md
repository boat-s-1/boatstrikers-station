# Agent Controller — atomic incident and notification outbox test (2026-11-17)

## Added to disposable PostgreSQL CI
- Intentional outbox CHECK constraint failure after reservation INSERT inside one transaction; verify the reservation was rolled back.
- Successful reservation plus outbox INSERT within one transaction; require one row in each table.
- Replay same incident with a different attempt and outbox ID using `ON CONFLICT DO NOTHING`; require one reservation and one outbox row.

## Scope and limits
This is real PostgreSQL transaction behavior in a temporary GitHub Actions service, but **not the production schema, live application worker, or external notification system**. The current CI schema is a deliberately minimal model; production DDL and RLS must be validated separately. No credentials, notification destinations, live traffic, or production mutations are used.

A successful result supports database atomicity for this test schema. It does not prove exactly-once delivery, durable receipt processing, restart safety of the full app, or production readiness. Keep deployment HOLD.
