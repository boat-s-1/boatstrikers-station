# GitHub migration inventory versus production — 2026-11-16

Read-only GitHub contents API inventory of `supabase/migrations` on PR #298 branch found **57 directory entries, 56 SQL files**, with earliest filename `20260821_ai_v2_public_character_stats.sql`. Production Supabase reported **133 migration records**, earliest `20260819205859 ai_v2_phase1` (from prior read-only migration inventory). Counts and timestamps differ, but this alone does **not** prove migration replay failure cause: files may have been renamed, squashed, or applied through a different history.

## Verified migration source files
- `supabase/migrations/20260923133500_add_openapi_bootstrap_rpc.sql` exists, 5407 characters. Defines `bs_apply_openapi_bootstrap` and explicitly revokes PUBLIC, anon, authenticated EXECUTE, granting service_role. Its initial event INSERT does **not** list `data_source` while the current production function does. This is an actual source-versus-live definition difference.
- `supabase/migrations/20260923144500_bootstrap_reconcile_and_result_provenance.sql` exists, 15334 characters. Adds event provenance columns and entry reconciliation, explaining at least some later schema/function changes. Inspect complete file and compare function definitions before asserting exact equivalence.
- Both filenames differ from the recorded production migration identifiers previously surfaced (`20260923133247` and `20260923153044`), so migration identity reconciliation is necessary.

## Consequence
- A new Supabase branch that replays only current repository migrations is not yet a validated production clone.
- Need canonical production schema-only baseline, exact migration history mapping, function-definition diff, and dependency-complete replay. Do not invent baseline DDL or copy private data.
- Avoid another paid branch until reproducible schema is demonstrated.
- No production writes, workflow runs, or deployment occurred.
