# PR298 — two additional dependency tables: RLS and grant parity (2026-11-18)

## Production read-only evidence

Both `public.bs_race_result_entries` and `public.racer_gender_master` have `relrowsecurity=true`, `relforcerowsecurity=false`. For each, PostgreSQL table-level SELECT/INSERT/UPDATE/DELETE privileges are granted to `anon`, `authenticated`, and `service_role`. The `anon` and `authenticated` roles have `rolbypassrls=false`; `service_role` has `rolbypassrls=true`.

Policies:
- `bs_race_result_entries`: two SELECT-only (`polcmd='r'`) policies, both `USING (true)`, for `anon` and `authenticated`, named `Public read race result entries` and `public read bs_race_result_entries`. No write policies found.
- `racer_gender_master`: **no pg_policy rows**. Under ordinary non-bypass RLS semantics, its grants alone do not allow anon/authenticated rows to be read or written. This is metadata-based inference, not a live API permission test.

## Restoration consequence

Do not blanket-copy a SELECT policy from the race result entry table to `racer_gender_master`; doing so would broaden its observable access. Current-state metadata does not prove the historical policy state at migration #2. Neither current-state structure nor the six-table isolation candidate constitutes an authoritative August genesis baseline.

## CI scope

Commit `648c5ef1f2068d57696081f72ca0f361cf10c5f3` offline contract #363 PASS (run 44159559582); PostgreSQL fixture #358 was in progress when checked. These CI tests are synthetic and do not verify the actual two production tables.

## Safety

Read-only production SQL; no production DB/Cron mutation, no paid branch. PR298 Draft/HOLD.
