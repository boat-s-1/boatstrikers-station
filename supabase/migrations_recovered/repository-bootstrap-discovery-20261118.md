# Repository bootstrap-source discovery — 2026-11-18

Read-only GitHub Git tree inspection of audit-branch commit `dfc4e7a4055e086aa066891392d346a1c3ab0148`: 2,255 tree entries, `truncated=false`. Inspected root directories, `database/`, `scripts/`, `supabase/`, and filenames matching schema/bootstrap/baseline/race SQL.

- `database/` contains `exhibition-acquisition-status.sql` and `exhibition-write-guard.sql`.
- `supabase/migrations/` contains later dated migrations, including `20260923133500_add_openapi_bootstrap_rpc.sql` and `20260923144500_bootstrap_reconcile_and_result_provenance.sql`; filenames indicate application bootstrap/reconciliation, not necessarily historical CREATE TABLE for early race tables.
- `supabase/migrations_recovered/` contains 133 recovered registry statement files and audit docs.
- No filename clearly identified a complete initial `bs_race_events`, `bs_race_entries`, `bs_race_results`, `bs_race_result_entries` bootstrap.

**Limitations:** filename/tree inspection cannot prove absence of SQL embedded inside unrelated source files or historical commits, or files in other repositories. The audit-branch tree was inspected; Git history and remote branches have not been exhaustively searched. Do not claim bootstrap source is impossible to recover.

**Next:** investigate historical commits, alternate branches and indirect code references; use a disposable offline PostgreSQL environment before requesting new paid branch. No production changes or Cron modifications.
