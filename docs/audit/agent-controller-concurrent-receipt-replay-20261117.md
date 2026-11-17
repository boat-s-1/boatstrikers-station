# Agent Controller — concurrent conflicting receipt identities (2026-11-17)

The disposable PostgreSQL CI workflow now launches two independent psql sessions. Session A inserts a synthetic receipt identity and holds its transaction for two seconds. Session B concurrently submits a different receipt ID for the same incident. The test expects the unique constraint to serialize the conflict: A is accepted, B is classified `hold_conflicting_replay`, and only one receipt ledger row remains.

This tests one controlled contention ordering and not every possible interleaving. The function currently returns `hold_race_retry_required` if an insert conflict is reported but no matching committed row is visible; production handling needs a bounded retry and alert policy. It does not test actual provider authentication, crash between provider send and receipt, or production RLS. CI-only, no production changes, release HOLD.
