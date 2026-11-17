# Cloud OpenAPI base-race collection — release gate (PR #298)

Status: **DESIGN ONLY / NOT ENABLED**. No production schedule, API invocation, or database write is authorized by this document.

## Observed failure
- Production DB cron `bs_sync_openapi_today()` applies preview and result data but does not invoke `bs_apply_openapi_bootstrap`.
- The Next.js `/api/live/openapi-preview` route has a CRON_SECRET guard in this Draft PR and invokes bootstrap for the JST current date.
- The checked `vercel.json` does **not** schedule that route.
- 2026-11-13 through 2026-11-16: 600 confirmed results exist but corresponding base event/entry rows do not.
- A Vercel deployment status of SUCCESS is not proof that an authenticated route was exercised.

## Proposed cloud-only flow (requires separate review and approval)
1. Obtain an independently verified **official** manifest of scheduled races for the JST date. Compare course/race keys with OpenAPI before any write. Source disagreement or empty manifest => STOP.
2. Authenticate a server-to-server call using `CRON_SECRET`; do not expose credentials in query strings, responses, or logs. Confirm the exact deployed environment has the secret.
3. Validate each expected race and its six unique boats, racer registration numbers, date, numeric bounds, cancellation handling, and freshness. Verify BRDB precedence and never replace existing official values with fallback.
4. Call the current-day bootstrap RPC **only after** those gates; capture returned insert counts and fail closed on partial/ambiguous outcomes.
5. Apply preview fallback only after bootstrap success. Recheck event/entry counts, existing results and payouts, and unexpected alert/theory trigger effects. A route's sequential RPC calls are not one database transaction: partial writes remain possible; do not claim atomicity without a reviewed transactional implementation.
6. Emit metrics and alerts for zero races, missing six-boat sets, result-only keys, and nonzero failures. Keep retries bounded and idempotent; verify concurrency behavior in an isolated DB.
7. Only then propose an explicit Vercel Cron entry with UTC/JST mapping, frequency, invocation cost estimate, and deployment/rollback steps. Do not enable it in this Draft PR without approval.

## Remaining evidence
- Independent official schedule and authenticated source parity
- Node test execution for new negative/contract suites (committed but not yet run)
- Isolated current-day trigger/alert/theory, duplicate concurrent calls, cancellation, and rollback
- Production deployed endpoint 401 on missing/wrong auth, authenticated smoke in isolated environment
- Owner approval for any new recurring billable invocation and production writes

## Rollback
Disable only the newly introduced schedule first, retain current data and audit logs, and do not delete or overwrite saved results. A failed bootstrap must not be automatically retried at unbounded frequency.

Useful read-only query: `scripts/cloud-sync-offline/PRODUCTION-READONLY-HEALTHCHECK.sql`.
