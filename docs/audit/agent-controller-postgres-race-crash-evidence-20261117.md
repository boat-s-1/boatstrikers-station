# Agent Controller — PostgreSQL race and crash injection (2026-11-17)

## Environment
GitHub Actions disposable `postgres:17` service with fixed CI-only database `agent_controller_ci` on `127.0.0.1`. Scripts refuse other targets. No Supabase keys, production writes, external notifications, or schedules.

## Verified
- Race workflow run [44059363291](https://github.com/boat-s-1/boatstrikers-station/actions/runs/44059363291) succeeded on commit `0a8274f057ea79ea98154022872d65accb6c014d`. Two PostgreSQL sessions contended for the same incident reservation and outbox unique index; each table retained one row.

## New crash-injection test (pending CI)
- Opens a transaction, inserts an incident reservation, sleeps before COMMIT.
- A separate connection locates the test backend by `application_name` and terminates it with `pg_terminate_backend`.
- Checks that the uncommitted reservation did not persist.
- Retries twice using `ON CONFLICT DO NOTHING`, requiring exactly one row.
- **This tests DB transaction rollback on backend termination, not application crash recovery or external notification exactly-once delivery.** Do not mark those higher-level gates verified based on this test alone.

## Remaining HOLD
Real application restart/replay behavior, delivery receipts, external idempotency, latency, retention approval, independent security review, and explicit production approval. PR stays Draft.
