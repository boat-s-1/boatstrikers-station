# PR298 — Remaining three isolation tables, production access inventory (2026-11-18)

Read-only production catalog check for `bs_source_first_seen`, `bs_theory_recommendations`, and `bs_ichika_escape_surge_alerts`.

For **each** table, all three roles (`anon`, `authenticated`, `service_role`) report SELECT/INSERT/UPDATE/DELETE table privileges; RLS is enabled; **zero non-SELECT RLS policies** were returned. Prior check established `anon` and `authenticated` do not bypass RLS, while `service_role` does.

Combined with `PR298-PRODUCTION-GRANTS-RLS-PARITY-20261118.md`, all six candidate tables now have table-grant and non-SELECT-policy metadata checked against production. This is **not** a live negative write test and does not prove complete schema/trigger parity. Candidate `GRANT ALL` is not automatically a security regression relative to current production grants; RLS and bypass roles remain essential.

Do not change production grants or RLS as part of PR298 diagnosis. Verify isolated test behavior before proposing any security changes.
