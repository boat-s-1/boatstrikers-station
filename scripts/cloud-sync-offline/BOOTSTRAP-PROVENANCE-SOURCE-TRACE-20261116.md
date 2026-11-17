# Bootstrap provenance source traced — 2026-11-16

Direct inspection of actual GitHub migration source files and live production function (read-only).

1. `supabase/migrations/20260923133500_add_openapi_bootstrap_rpc.sql` initially creates `bs_apply_openapi_bootstrap`; the event INSERT does not populate `data_source`.
2. `supabase/migrations/20260923144500_bootstrap_reconcile_and_result_provenance.sql` first adds `data_source` and related provenance columns to events, plus `bootstrap_reconciled_at` on entries, and then **replaces** `bs_apply_openapi_bootstrap`. The replacement explicitly writes `'BOATRACE_OPEN_API_BOOTSTRAP'` for events and entries. It also defines entry reconciliation triggers and result-provenance logic.
3. Live production `pg_get_functiondef` confirms the event and entry bootstrap source markers are present.

**Correction to previous inventory note:** The source-versus-live difference in event `data_source` is explained by a later committed migration; it is not evidence by itself of an untracked production hotfix.

## Remaining blocker
The original table baseline is still missing from the checked GitHub migration directory; an isolated Supabase branch previously lacked the required tables/functions. Verify the full migration replay and schema baseline before paid re-test. Recorded migration identifiers and repository filenames still differ, so a one-to-one mapping cannot be assumed.

No production writes, deployment, or paid branch creation.
