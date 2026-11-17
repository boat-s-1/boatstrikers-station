# PR #298 — Historical program restore GO/HOLD checklist

**State: HOLD.** This is an operator checklist, not an authorization to deploy or execute. Do not run the candidate against production until each independent gate has evidence and explicit approval.

## Source gate
- [ ] Identify the authoritative historical *program* archive for each requested race (not today's OpenAPI endpoint and not results-only data).
- [ ] Record source URL/provider, capture timestamp, original immutable file hash (SHA-256), collection method and license/permission for storage, processing and use.
- [ ] Verify that a pre-race capture is allowed: archived program files may legitimately be captured **before** race day. The candidate accepts any non-null capture timestamp not over five minutes in the future; this does not prove provenance.
- [ ] Verify the complete six boats and registration numbers against the archived original, per race. Record any absent, ambiguous or conflicting source and exclude it.

## Production preflight — read-only
- [ ] Recompute exact race-key allowlist at execution time using `PR298-HISTORICAL-RECOVERY-EXACT-ALLOWLIST-READONLY.sql`; do not assume the earlier 732-race count is still current.
- [ ] For each requested key require one `bs_race_results` row, `result_status='confirmed'`, nonblank `trifecta_result`, and no partial existing program. Treat missing or non-confirmed results as HOLD.
- [ ] Compare source race keys with the allowlist; exclude extras and all current/future JST dates. Candidate hard limit: 2026-11-13 through 2026-11-17.
- [ ] Confirm no unexpected existing events/entries and verify the production schema, triggers, dependent consumers and role permissions.
- [ ] Capture before-state counts and immutable audit evidence, including existing payouts and result rows.

## Execution gate — requires explicit approval
- [ ] Two CI jobs pass on the *exact approved commit* (offline contract + PostgreSQL fixture).
- [ ] Approve the exact archived inputs, SHA-256s, race-key list, batch size, privileged caller and deployment/rollback plan.
- [ ] Obtain explicit authorization separately for production SQL installation and for production data writes; do not infer authorization from development approval.
- [ ] Use a controlled, small first batch with a transaction and stop on mismatch. Recheck results, payout invariance, six-boat counts and dependent data after every batch.
- [ ] Keep the production Cron, Vercel and Windows worker unchanged unless separately approved. No automatic retries of a rejected batch.

## Known limits
- The candidate is **not deployed** and cannot authenticate the archived source by itself; the caller must enforce the approved source hash and exact race allowlist.
- Result confirmation is evidence of a settled race, **not** evidence that the archived program is authentic.
- A successful CI fixture is not a production migration test. Production has more migrations and dependencies than the disposable schema.
- Current-day cloud synchronization, historical backfill, and Windows retirement are **separate** approvals and rollouts.
