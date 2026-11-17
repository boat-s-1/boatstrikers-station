# PR298 — CI evidence: real-query Ichika fixture and migration replay gap (2026-11-18)

Status: **HOLD for production and paid Supabase branch retry**. This report records observed evidence; no production DDL/DML/Cron changes.

## CI verification

At commit `f11cb2beb0d982f16237a6fb0bc657c3cb4657ec`:
- Offline contract workflow #338: success.
- PostgreSQL fixture workflow #333: success (run `44134098212`, job `134218770142`).
- The job ran `openapi-atomic-trigger-fanout.test.sql` with an observable stub evaluator, and `openapi-real-ichika-evaluator.fixture.sql` with a simplified real-query evaluator.
- Log evidence: `REAL_EVALUATOR_144_RACES_864_INSERT_CALLS_MS=1007.3`, followed by `REAL_EVALUATOR_144_RACES_PASS`. This is **one CI-run measurement**, not a production latency guarantee.
- The 144-race/864-entry fixture intentionally runs an evaluator for each inserted entry. It checks that no false alerts are created by program-only bootstrap and tests one qualified exhibition alert and replay.
- The PostgreSQL workflow installs **selected captured writers and fixtures** into disposable PostgreSQL databases. It **does not replay the full Supabase migration history** or provision a Supabase development branch.

## Supabase migration failure

The previous paid branch `pr298-atomic-isolation-20261118` reached `MIGRATIONS_FAILED` and was deleted after approval. No failed migration name/SQLSTATE was exposed by the branch status. A previous unrelated branch also reports `MIGRATIONS_FAILED`; common root cause is not established.

Direct production history-to-Git comparison proved `add_openapi_bootstrap_rpc` SQL matches after stripping trailing newline, despite migration version prefixes `20260923133247` and `20260923133500`. Do not treat the prefix mismatch as a proven migration failure.

## Required gates before release

1. Obtain actual Supabase failed migration version, SQLSTATE and build logs from Supabase support/dashboard if available.
2. Run full migration replay (not merely captured-writer fixtures) in a disposable environment using the exact source migration set and ordering.
3. Run representative real-trigger graph and production-like data volume with latency/timeout ceilings.
4. Verify provider payload completeness, permission isolation, atomic rollback, alert delivery, and historical result-only records.
5. Obtain separate approval for any production change; keep existing Cron unchanged until verified.

No new paid branch was created during this investigation.
