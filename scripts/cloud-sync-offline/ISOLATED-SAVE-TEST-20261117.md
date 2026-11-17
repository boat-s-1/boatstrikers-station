# PR #298 isolated save test — 2026-11-17 JST

Authorized hourly rate: US$0.01344. Created disposable branch `pr298-schema-save-test-20261117` (`ppjhtzqcwmpndibeqalq`), observed `MIGRATIONS_FAILED` with no core table or bootstrap function. Applied `SIX-TABLE-ISOLATION-CANDIDATE.sql` **only to this branch** using one transactional migration; migration succeeded. Catalog after load: six tables, 26 constraints, 10 non-internal triggers.

Fixture on 2020-01-02, course 24, race 12: bootstrap returned event_inserted=1, entry_inserted=6; readback 1 event and 6 entries. Repeat call returned 0/0. First-seen, Ichika alerts and theory tables stayed at zero for this fixture. Malformed numeric entry on a separate 2020-01-03 race raised an invalid-text conversion error inside a caught subtransaction; readback confirmed 0 events for that race.

This tests only a synthetic past race and a limited failure path. It does not establish full schema parity, historical 600-race correctness, live-day side effects, API authentication, result status reconciliation, or production readiness. Branch creation status `MIGRATIONS_FAILED` remains a project-migration issue; the SQL was loaded manually after that status.

Deleted the disposable branch after tests; subsequent branch listing did not contain it. No production database write, merge, or deployment. Final billed amount is not yet available.
