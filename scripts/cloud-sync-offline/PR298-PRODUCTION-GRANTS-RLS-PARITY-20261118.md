# PR298 — Production grants and RLS policy parity (2026-11-18)

Read-only `pg_roles`, `pg_policies`, and `has_table_privilege` checks on production project `rzosrbkyniyedolhkgxo`. **No writes were performed.**

For each of `public.bs_race_events`, `public.bs_race_entries`, `public.bs_race_results`, `anon`, `authenticated`, and `service_role` all report SELECT/INSERT/UPDATE/DELETE table privileges as true.

All three tables have RLS enabled. The observed six policies (two per table) are **SELECT-only**; none of the six is an INSERT/UPDATE/DELETE policy. `anon` and `authenticated` have `rolbypassrls=false`, `rolsuper=false`; `service_role` has `rolbypassrls=true`, `rolsuper=false`.

**Important correction to earlier candidate review:** the `GRANT ALL` clauses in `SIX-TABLE-ISOLATION-CANDIDATE.sql` do match the observed broad *table-level* privileges for the three core tables. They do **not**, on their own, mean anonymous users can write rows; RLS must be considered. Do not assert an actual write bypass without an isolated end-to-end authorization test. This does not validate parity for the other three candidate tables, sequences, functions, grants by role membership, or API behavior.

Safe next gate: inspect isolated roles and policy parity, test `SET ROLE anon` and `SET ROLE authenticated` write attempts against disposable fixture rows, and verify `service_role` write succeeds as expected. Keep the candidate isolation-only; full migration replay and production cutover remain HOLD.
