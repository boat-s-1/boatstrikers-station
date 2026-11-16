# PR #298 — Cron cutover / rollback runbook (NOT AUTHORIZED)

Status: **HOLD**. This is a decision and operations checklist, not a migration.
Do **not** execute production SQL or change a Cron job based on this document alone.

## Verified current state (read-only, 2026-11-17)
- Active `cron.job` jobid 1: `boatstrikers-openapi-live-3m`.
- Schedule: `*/3 23,0-14 * * *` (UTC); current command calls `public.bs_sync_openapi_today()`.
- The function fetches `today.json`, applies preview entries, preview events and results; it does **not** bootstrap program events or six-boat entries.
- `bs_apply_openapi_atomic_candidate` is **not installed** in production.
- Next.js `app/api/live/openapi-preview/route.js` is **not** called by jobid 1. Enabling the Next.js atomic flag alone does not fix Cron.
- Nov 13–16: 600 result races missing events and all six entries (3,600 entry slots).
- Baseline: `openapi-cron-cutover-preflight.readonly.sql` and `openapi-historical-gap-readonly.sql`.

## Engineering gate: prove the caller, not just the callee
1. Choose exactly one deployment path: (A) a tested DB-side Cron wrapper that fetches the official document, validates six-boat programs, and invokes the atomic RPC; or (B) a secure server-side HTTP Cron endpoint with secret management, verified authorization and retry behavior.
2. Preserve the existing job command verbatim as a rollback artifact. Do not assume the Next.js route is automatically invoked.
3. Verify real current-day OpenAPI payload shape, including registration-number formats, race date, preview/result presence and partial settlement, against the new parser.
4. Validate every event/entry/preview/result key against the same six-boat official program **before writes**. Reject empty, partial, duplicate or inconsistent payloads.
5. Run same-transaction rollback, replay/idempotency, advisory lock contention, 100+ races, and actual trigger side effects in an isolated environment. The isolated Ichika stub only establishes invocation fan-out, not production downstream effects.
6. Independently validate expected official schedule coverage and record a read-only before/after reconciliation. Never synthesize missing races from a result-only row.
7. Review service_role-only EXECUTE, caller authentication, secret exposure, 3-minute overlap, network failures, statement timeouts and durable error telemetry.
8. Obtain explicit approval for **each** production function installation, Cron switch, feature-flag/deployment change, and historical backfill. A prior paid test-branch approval does not authorize a new paid branch.

## Staged release (after all gates and explicit approval)
- Snapshot `cron.job` row and original function definition, including SHA-256 in an auditable release record.
- Install the validated atomic function and its independently tested caller without changing jobid 1.
- Run a strictly bounded, separately approved canary with real official payload; confirm expected inserted keys, source priorities, trigger side effects and logs.
- Change only the intended Cron command in a controlled transaction, preserving schedule and job identity. Re-read `cron.job` to verify the exact command.
- Monitor several executions and compare event/entry coverage and alerts. A green Cron execution status alone is insufficient.
- Keep historical backfill **separate**: Nov 13–16 need archived official data and a historical-only approved process; the current-day atomic RPC rejects past dates.

## Rollback triggers and procedure
Stop and revert if incomplete six-boat programs, new duplicate keys, unbounded Ichika fan-out, unexpected notifications, partial writes, privilege regression, or repeated Cron failures occur.

1. Restore the exact saved legacy job command (not an improvised function name); keep original schedule and jobid.
2. Disable any newly enabled route/feature flag through the same deployment control.
3. Verify the old function is still present and the Cron command points to it; inspect recent Cron execution status.
4. Leave already written race rows untouched pending an explicit reconciliation review. Do **not** delete entries or drop a function with unknown dependencies as a reflexive rollback.
5. Preserve incident logs, before/after counts and the precise SQL/deployment revisions.

## Release decision
**HOLD** until real OpenAPI parity, actual Cron caller integration, full trigger impact, safe canary and explicit approvals are all complete.
