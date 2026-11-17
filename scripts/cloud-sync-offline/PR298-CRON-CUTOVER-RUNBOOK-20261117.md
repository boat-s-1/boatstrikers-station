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

## Mandatory provider-compliance decision before any cutover (2026-11-18)

- Existing PR298 provider-compliance review records the user's report that an API provider requested stopping five-minute Windows polling, and the user stopped the Windows scheduler. It remains unproven whether the request also covers the production Cron source.
- The currently active production jobid 1 polls the public OpenAPI today.json endpoint on a three-minute schedule. Do not assume cloud polling is exempt from a provider request, and do not test this question by sending additional live requests.
- Before changing or resuming any fetcher, obtain the original provider communication and identify the exact service, endpoint, prohibited operations, permitted request frequency, caching/redistribution rules and effective date. If it covers jobid 1, seek an explicit operator decision on promptly pausing or reconfiguring that job.
- A software repository MIT license does not establish rights to the underlying race-program data. Require data-use and commercial publication authorization separately.
- Cutover requires exactly one approved compliant fetcher; no dual Cron overlap, frequency escalation, or fallback that bypasses a restriction. Keep the existing writer unchanged until the operator decides on the current compliance risk.
- Current verified CI at 7da461ec: offline contract run 44123384529 SUCCESS and disposable PostgreSQL fixture run 44123384823 SUCCESS. These do not establish upstream data rights or live Supabase persistence safety.

**Compliance gate: HOLD.** This document does not authorize stopping the existing Cron or creating another polling job.

## 2026-11-18 provider scope and refreshed CI evidence

The user supplied the original provider email screenshot. It explicitly names **team-nave BRDB-API**, cites Q011 SQL query optimization, describes morning/evening data refreshes, and requests stopping five-minute high-volume BRDB polling. The active jobid 1 uses the distinct **boatraceopenapi.github.io** endpoint. Therefore the earlier uncertainty about whether the BRDB email names the OpenAPI Cron source is resolved: **it does not**. The OpenAPI source's own rate limits and data-use rights remain a separate, unresolved gate. Do not infer OpenAPI permission or a three-minute polling entitlement from this distinction.

The latest verified PR HEAD at this checkpoint is `030cb6111144764f6808a6410bb395ef45b99c48`. GitHub Actions: V3 offline contract run `44127641018` SUCCESS; V3 PostgreSQL fixture run `44127640944` SUCCESS. The read-only production readiness SQL was also executed successfully, detecting orphan results for Nov 14-17. These results do **not** authorize production write deployment, Cron repointing or new paid resources.

Operational HOLD remains: independent OpenAPI permission/rate assessment, isolated live-schema and trigger parity, actual writer integration, safe cutover/rollback approval, and historical recovery provenance.

## 2026-11-18 live release preflight results (read-only)

Executed `openapi-cron-cutover-preflight.readonly.sql` on production, without writes. Six results:
- `single_active_live_cron`: true
- `legacy_job_not_modified`: true
- `legacy_function_still_without_bootstrap`: true (diagnostic)
- `legacy_function_still_without_atomic`: true (diagnostic)
- `atomic_candidate_installed`: false (release gate)
- `atomic_service_role_only`: false (release gate, because candidate is absent)

This is an expected pre-deployment HOLD, not evidence of a broken installed atomic function. No production function installation, Cron modification or API fetch was performed.
