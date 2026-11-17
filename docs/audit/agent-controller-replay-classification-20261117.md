# Agent Controller — identical vs conflicting receipt replay (2026-11-17)

A disposable PostgreSQL test function `classify_receipt_replay_ci` distinguishes:
- `accepted_new`: first unique receipt/incident/payload digest.
- `duplicate_identical`: exact same receipt ID, incident ID and digest.
- `hold_conflicting_replay`: same receipt ID or incident ID with changed identity or digest.
- `hold_invalid_input`: empty/null fields.
- `hold_race_retry_required`: conflicting insert without a visible matching row (e.g. concurrent race visibility).

The CI script tests these categories and verifies one ledger row remains. This improves evidence of **conflict detection**, not production readiness. The test-only PL/pgSQL function does not log an audit event, verify a real provider signature, enforce a cryptographic digest format, or prove multi-session concurrency correctness for the classifier. In production, conflict should be durably audited and never automatically retried. No real notifications or production DB changes; release HOLD.
