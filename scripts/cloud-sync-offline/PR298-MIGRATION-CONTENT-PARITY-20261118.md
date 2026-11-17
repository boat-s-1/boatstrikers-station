# PR298 — Migration history content parity follow-up (2026-11-18)

**Read-only verification; production and Cron unchanged. No new paid branch.**

## Evidence

- GitHub branch `codex/cloud-sync-offline-gate-20261116` contains `supabase/migrations/20260923133500_add_openapi_bootstrap_rpc.sql` (5407 characters, blob SHA `777fb1a5576742589d547d9222b354e0ba15f4b5`).
- Production `supabase_migrations.schema_migrations` version `20260923133247`, name `add_openapi_bootstrap_rpc`, contains 5406 characters in its stored SQL statement. Its stored MD5 is `154b43943bea81aab3f9931cedbfce79`.
- **Direct comparison of the GitHub file text with production stored SQL returned `exact_equal=false`, `equal_without_final_newline=true`.** Thus the entire SQL text matches after stripping trailing newlines. The timestamp filename discrepancy is not evidence of a functional SQL difference for this one migration.
- Production history also contains `20261116123313 / s01_bsc_results_restrict_public_writes_20261116` with 3864 SQL characters, MD5 `c4a36de1a352a4538ff1fc66becc24e7`; its stored SQL mentions `bsc_results`, `revoke`, and `policy`. An exact path lookup for that version on the PR branch returned 404; no complete Git tree inventory was performed.
- Latest PR commit `2f77c3d00637dd5850db837a3b4e1c4a02ef06f0` passed both CI workflows: offline contract #337 and PostgreSQL fixture #332. These do **not** test Supabase branch migration replay.

## Remaining unknowns

The precise failing migration version, SQLSTATE, error message, and migration replay source are **not available from the observed branch response**. Both failed branches are insufficient to establish the root cause. Avoid attributing failure to bootstrap file name, S01, or migration order without logs.

## Next safe gate

1. Retrieve branch build/migration logs from a supported Supabase channel or ask Supabase support for the failed version and SQLSTATE.
2. Compare complete migration trees and production migration history, including the source revision and nontracked migrations.
3. Reproduce the specific failure in a disposable local/CI PostgreSQL database before another paid attempt.
4. No production migrations, Cron edits, PR merge, or paid branch retries until diagnosed.
