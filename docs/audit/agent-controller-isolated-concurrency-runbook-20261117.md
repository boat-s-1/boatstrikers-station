# AI司令塔 — 隔離環境検証ランブック（2026-11-17）

Status: PREPARED / NOT EXECUTED. PR #299 remains Draft.

## Preconditions
- Confirm an isolated Supabase branch/project identifier, its current billing rate, and explicit authorization for **test-only writes**. Previous hourly pricing is historical and must be reconfirmed.
- Confirm zero production credentials are used. Check the test database host/project ID twice before SQL.
- Restrict test schema to `agent_monitor_test` in the isolated environment. No external notifications; test only synthetic metadata.
- Assign a unique run ID and record start time, project ID (not secret), branch, test plan and operator.
- Set maximum session time and billing ceiling; do not start if either is unverified.

## Planned tests
1. Create test-only tables in an isolated schema with unique incident key, unique outbox incident and RLS; verify unprivileged read/write denied.
2. Run two concurrent transactions claiming the same incident key; assert exactly one commit, the other conflicts or observes existing reservation.
3. Simulate crash after reservation but before notification: restart must HOLD; no automatic send.
4. Simulate provider delivery uncertain: HOLD even after lease expiration; operator review required.
5. Simulate duplicate outbox inserts and receipt replay; assert unique constraint and idempotency behavior.
6. Simulate malformed input, missing authentication, stale evidence and statement timeout. Fail closed.
7. Validate rollback of every test change; capture sanitized counts, SQLSTATE, durations and no credentials.

## Strict stop conditions
- Production project identifier detected; stop before any write.
- Unexpected schema or role permissions, concurrent duplicate reservation, external network attempt, cost overrun, timeout or test data outside allowlist.
- No TRINITY collector, article replay, live race API, webhook send, Vercel deploy, PR merge or production Cron mutation.

## Cleanup
- Confirm no active test transaction.
- Drop ONLY the explicitly created isolated `agent_monitor_test` schema after checking its owner and expected table list.
- If isolated branch is billable, delete it after verification and confirm no remaining billed branch; retain only sanitized test report.
- Do not delete any production or pre-existing objects.

## Evidence needed for GO
- Explicit operator signoff of sandbox, storage and notification destinations.
- Proof of real concurrent uniqueness and role isolation.
- Approved destination sandbox receipt evidence; independent cost guardrail and query runtime measurement.
- A separate explicit approval for any production rollout, with reversible migration and kill-switch verification.
