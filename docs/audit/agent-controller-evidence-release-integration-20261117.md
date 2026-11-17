# AI司令塔 — Evidence-to-release integration review (2026-11-17)

## Implemented in Draft PR #299
- `cron-monitor-evidence-manifest.mjs` enumerates ten required verification categories; missing, failed, and untested are not accepted as verified.
- `cron-monitor-release-evidence.mjs` cross-checks seven operator approval flags against matching evidence categories. Sequential uniqueness is **not** treated as parallel race evidence. Offline-only evidence does **not** support isolated race validation.
- Both modules remain **offline-only, fail-closed**: `decision=hold`, no live DB access, no notification delivery, no deployment, no auto-replay.
- References are syntactically checked GitHub links, **not cryptographic attestations**. Even complete claimed evidence cannot authorize production.

## Evidence currently supported by actual isolated test
- `schema_execution`: PostgreSQL 17 DDL applied in disposable isolated branch.
- `sequential_uniqueness`: sequential duplicate inserts yielded one reservation and one outbox row.
- `row_level_security`: catalog showed RLS on all three tables, and role privilege checks denied anon SELECT and authenticated INSERT.
- `rollback`: transaction-scoped inserts were rolled back, subsequent row counts were zero.
- The isolated branch was deleted and its absence checked. These observations are documented in `agent-controller-isolated-db-validation-result-20261117.md`.

## Not demonstrated
- Concurrent multi-session race behavior, crash recovery, real notification delivery receipts and idempotency, performance benchmark, approved retention, independently authenticated evidence, and operator/security review.
- **Do not** mark `parallel_race` or `delivery_receipt` as verified based on the existing test.
- Next engineering gate: reproducible parallel-session PostgreSQL test and crash injection in a newly approved disposable environment, then security review. Do not create another paid branch without its own authorization.
