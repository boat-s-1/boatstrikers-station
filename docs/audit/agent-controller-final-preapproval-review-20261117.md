# AI司令塔 — 本番導入前の最終設計レビュー（2026-11-17）

## Prepared without production mutation
- A **non-deployed** SQL schema draft at `docs/audit/sql/agent-monitor-schema-DRAFT-DO-NOT-RUN.sql`, transaction wrapped with ROLLBACK and intentionally not in the migration directory.
- 14 static SQL contract checks: unique attempt starts, unique incident keys, unique outbox incident, foreign key, RLS enabled, no broad grants or Cron scheduling.
- Nine cross-module failure tests: timeout, connection, permissions, invalid result, policy hold, stale evidence, duplicate reservation, cooldown, and operator stop.
- All changes remain in Draft PR #299; no production schema changes, webhook notifications, schedule or collector reactivation.

## Design issues requiring engineering review
1. RLS enabled alone does **not** protect from privileged service roles; least-privilege DB roles and grants must be reviewed separately.
2. A unique incident key prevents duplicate inserts but does not alone implement safe cooldown-based re-notification. Atomic compare-and-set, lease expiry and crash recovery need a concrete transactional design.
3. A database outbox is not a sent notification; provider receipts and failure modes must be independently verified.
4. The proposed retention policy never deletes data; legal hold and deletion implementation need approval.
5. `EXPLAIN` is not a runtime benchmark; article `created_at` has no index and production query timing has not been measured.
6. Operator-provided approval and authentication booleans are not independently attested.
7. The draft schema has no application integration, no migration execution and no actual notification destination.

## Stop boundary
Do not deploy, merge, create production tables, install credentials, send Discord/email alerts, schedule polling, or restart TRINITY until the user confirms the destination, hourly cadence, cost ceiling, storage/retention policy and explicitly approves production deployment. The repository's offline workflow is permitted to run tests only.
