# PR298 — Failed Supabase branch migration: read-only triage (2026-11-18)

**State: HOLD.** New branch `pr298-atomic-isolation-20261118` (`wfuplnvetkamgavdufqi`, branch id `3ac1ec48-c2d6-4985-ba26-b3a69a77b6fb`) was created after approval at USD 0.01344/hour. It reached `MIGRATIONS_FAILED`; the project was not available through `get_project` (`Project not found`). Branch deletion returned success and a subsequent branch list confirmed its removal. **No branch SQL tests were run.** No production DML/DDL/Cron changes.

## Read-only evidence

- Production `supabase_migrations.schema_migrations` contains `20260923133247 / add_openapi_bootstrap_rpc` (one stored statement).
- Current PR branch contains `supabase/migrations/20260923133500_add_openapi_bootstrap_rpc.sql`, whose numeric prefix does not match that production migration version. This alone is **not proof of a failing migration**, because remote migration history and Git files may have different provenance.
- Production migration history also contains `20261116123313 / s01_bsc_results_restrict_public_writes_20261116` (one stored statement). An exact-file fetch at `supabase/migrations/20261116123313_s01_bsc_results_restrict_public_writes_20261116.sql` on the PR branch returned 404. This is only an exact-path negative result, not proof the migration is absent elsewhere.
- Production history contains many other migrations. The failing branch's exact migration name, SQLSTATE, and database log message **were not obtained**; root cause remains unknown.
- Existing older branch `gamagori-pr294-phase13` also reports `MIGRATIONS_FAILED`, but a common cause is unproven.

## Required next diagnostic gate (no paid retry yet)

1. Obtain actual failing migration name and error/SQLSTATE from Supabase branch build logs or support, if accessible. Do not guess from naming differences.
2. Compare the complete Git migration tree at the **exact branch creation source revision** with remote migration history, including migration ordering, missing versions, duplicates, and destructive assumptions.
3. Check whether the source branch creation process replays migrations from a clean database or relies on production schema history; establish which history is authoritative.
4. Reproduce the exact failure in an existing free/disposable PostgreSQL fixture or GitHub Actions before authorizing another paid branch.
5. Once the failure is diagnosed and corrected, separately obtain approval for any new paid branch and then verify full real-trigger, rollback, permissions and performance tests.
6. Keep production and Cron unchanged. Do not reset or delete unrelated existing branches.

**Release decision:** HOLD — no verified migration replay, no production-equivalent atomicity test.
