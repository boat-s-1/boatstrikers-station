# Agent Controller — receipt replay ledger CI (2026-11-17)

Added a disposable PostgreSQL-only `receipt_replay_guard_ci` table with unique `receipt_id` and `incident_key`. The test verifies that exact replays, reused receipt IDs with different incidents, and reused incident IDs with different receipts cannot insert a second ledger row. It is wired into the isolated PostgreSQL GitHub Actions job.

This is a **database uniqueness test**, not a complete anti-replay protocol. The test does not compare existing payload digest to incoming digest on conflict, authenticate actual provider signatures, perform atomic reservation with real provider acknowledgment, or validate real provider delivery status. A conflicting replay is silently ignored by `ON CONFLICT DO NOTHING` in the test; production should distinguish harmless identical replay from suspicious mismatch and log/alert on the latter. No production migration or external delivery. Release HOLD.
