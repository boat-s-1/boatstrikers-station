# Isolation branch creation incident — 2026-11-16

## User authorization and cost
The user explicitly approved a Supabase development branch at USD 0.01344/hour, with deletion after testing.

## Actual operations
1. Cost confirmed via Supabase.
2. Created branch `cloud-sync-pr298-isolated-20261116` with project ref `xvwsssifpcjowcpfbzie`, branch id `2bebd757-6908-42a0-b5c1-cec043e80817`.
3. Branch status reached `FUNCTIONS_DEPLOYED`, preview project `ACTIVE_HEALTHY`.
4. A SELECT-only schema check returned:
   - `to_regclass('public.bs_race_events') = NULL`
   - `to_regclass('public.bs_race_entries') = NULL`
   - `to_regprocedure('public.bs_apply_openapi_bootstrap(jsonb,jsonb,timestamp with time zone)') = NULL`
   - Only 7 public tables visible.
5. **No data inserts, RPC calls, DDL, or application deployments were attempted.**
6. Deleted branch using Supabase delete_branch; returned `success:true`.
7. Independently verified via list_branches that this branch no longer exists.

## Implications
A healthy branch status did **not** mean the production BoatStrikers schema had been reproduced. Production has 133 recorded migration versions including `20260923133247 add_openapi_bootstrap_rpc` and `20260923153044 bootstrap_reconcile_and_result_provenance`, but the fresh branch lacked the necessary tables and function. The exact cause is unproven; possible gaps in migration baseline/replay must be investigated, not assumed.

## Next safe steps
- Audit repository migration files and branch migration replay logs without changing production.
- Establish a minimal self-contained isolation schema with the actual production constraints and relevant triggers, or restore a schema-only snapshot into a truly isolated project after reviewing costs.
- Do not create additional paid branches until the schema reproduction path is validated.
- The historical archive key parity and 4,200 candidate ID collision checks remain valid read-only evidence.
