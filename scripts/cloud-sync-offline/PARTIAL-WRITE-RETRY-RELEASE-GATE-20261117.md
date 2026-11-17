# PR #298 — partial-write and retry release gate (2026-11-17)

Status: **DRAFT / HOLD**. This is a test plan, not a production change or evidence of real DB recovery.

## Observed route behavior

Current-day GET/POST uses `CRON_SECRET` authentication and `BS_OPENAPI_TODAY_SYNC_ENABLED=true` opt-in. Once validated, it invokes three independent Supabase RPCs **sequentially**:

1. `bs_apply_openapi_bootstrap` (missing event and entry rows)
2. `bs_apply_openapi_preview` (boat-level preview)
3. `bs_apply_openapi_preview_events` (race-level preview)

The route stops after any RPC error. A failure in step 2 prevents step 3 from starting; a failure in step 3 does **not** roll back successful steps 1–2. These are not one database transaction. An HTTP 500 means the overall attempt did not complete; it does **not** mean zero rows were written.

## Offline evidence

- Actual repository test callbacks: **26/26 PASS** under an in-memory JS adapter with fake network and Supabase client, including a simulated first-attempt step-3 error followed by a successful second attempt.
- This verifies route invocation order and error propagation only. It does **not** prove SQL idempotency, triggers, locks, alert delivery or real network behavior.
- Official Node 22 `node --test scripts/cloud-sync-offline/*.test.mjs` and CI still need to be run and archived against a specific commit SHA.

## Required isolated-DB test matrix (explicit approval before paid branch)

| Scenario | Expected check |
| --- | --- |
| 1 race / 6 boats fresh bootstrap | 1 event, 6 entries; verify trigger counts and downstream alert evaluations |
| Repeat identical request | 0 additional event/entry rows, no duplicate alert deliveries |
| Step-1 bootstrap error | Neither preview RPC starts |
| Step-2 entry-preview error | Step 3 never starts; inspect whether step 1 committed |
| Step-3 event-preview error | Steps 1–2 may have committed; inspect row-level state |
| Retry after step-3 error | No duplicate rows, authoritative values unchanged, preview reconciled |
| 100+ races in one run | Alert fan-out, execution time, row locks, retry safety |
| Concurrent identical requests | Unique constraints, conflict handling, no double notifications |
| Source priority | BRDB/PC-KYOTEI confirmed fields remain unchanged |
| TRINITY snapshots | Immutable prior prediction inputs unchanged |

## Operational decision

Do **not** enable production current-day sync, production backfill, cron, or merge until isolated trigger-side-effect evidence and real-DB retry/idempotency tests pass. Avoid claiming atomicity or treating HTTP 500 as proof of rollback. Keep PR #297 independent.

## Recovery proposal if a run fails after partial writes

1. Keep current-day sync opt-in disabled in production.
2. Inspect logs for the failed RPC stage and source date; do not assume which rows committed.
3. Compare row counts and authoritative fields using read-only queries.
4. Check alert evaluation/delivery logs before any retry.
5. Retry only after verifying idempotency in the isolated environment and obtaining production authorization.
