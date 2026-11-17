# PR #301 — approved isolated Supabase branch test and cleanup (2026-11-17)

## Authorization and cost
User explicitly approved a temporary Supabase development branch at US$0.01344/hour. Management API returned the same hourly rate. This is a usage rate, not a measured final invoice.

## Isolation
- Production parent: `rzosrbkyniyedolhkgxo` (not mutated).
- Created disposable branch: `hatsune-pr301-isolated-20261117`, ref `fjongwkvssvpdqempngk`, branch ID `c17fb39a-d478-4200-9181-d2b2725a3f01`.
- PostgreSQL 17 confirmed.
- **Limitation:** `to_regclass('public.hatsune_news_cron_runs') IS NOT NULL` returned **false** on the branch; production schema was not available for direct target-table verification.
- Executed temporary-table transaction with `UPDATE ... RETURNING id`; first query returned one updated ID and unrelated row unchanged. A same-statement CTE snapshot check unexpectedly showed old status; a second query used separate SQL statements and confirmed `status_updated=true`, `unrelated_unchanged=true`, `missing_row_absent=true`.
- Every test transaction ended with `ROLLBACK`. No live article, Cron, notification, or API write was performed.
- Deleted branch successfully. Follow-up branch listing shows only pre-existing `gamagori-pr294-phase13` and `main`; newly created branch absent.

## What is and is not proven
- PASS: isolated PostgreSQL update/returning semantics and scoped-row behavior, on top of previous disposable PG Actions tests.
- PASS: production read-only catalog permissions for service_role SELECT/UPDATE (separate prior evidence).
- NOT TESTED: real `supabase-js` `.update().eq().select().maybeSingle()` request against an exposed branch table with deployed credentials and policies.
- NOT TESTED: application handler end-to-end, 60s timeout, or BOAT RACE source availability.
- No branch remains running; no new cost-bearing resource intentionally left behind.

## Release decision
**HOLD / Draft PR #301.** Review API-level integration, diff, and production deployment plan. Do not auto-replay prior `running`/`partial` jobs or merge without explicit authorization.
