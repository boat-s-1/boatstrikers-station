# PR298 — RLS negative-write CI evidence (2026-11-18)

## Exact successful CI run

Commit: `6e4ba6fa1752d975e7541a9f95f61c3f3cf9cc76`

- PostgreSQL fixture run #353, ID `44155157648`: **success**; isolated-postgres job `134293802198`: **success**.
- Offline contract run #358, ID `44155157028`: **success**.

## PostgreSQL fixture job log assertions

- `PR298_PASS: anon INSERT rejected by RLS`
- `PR298_PASS: authenticated INSERT rejected by RLS`
- `PR298_PASS: anon UPDATE affected zero rows under RLS`
- `PR298_PASS: anon DELETE affected zero rows under RLS`
- `PR298_PASS: authenticated UPDATE affected zero rows under RLS`
- `PR298_PASS: authenticated DELETE affected zero rows under RLS`
- `PR298_PASS: no unauthorized rows persisted`

This is a **disposable synthetic PostgreSQL RLS probe**, not a production API test or a full six-table RLS parity proof. It tests the semantics of broad table grants plus SELECT-only RLS policies; production's metadata for all six tables was separately audited.

## Remaining release blockers

- Provenance and version-correct reconstruction of pre-2026-08-19 schema baseline.
- Full chronological Supabase migration replay against a disposable branch.
- Real six-table permissions/trigger/load verification, and rights/rate review.
- Explicit authorization for any paid branch and later production cutover.

No production DB/Cron change; PR remains Draft/HOLD.
