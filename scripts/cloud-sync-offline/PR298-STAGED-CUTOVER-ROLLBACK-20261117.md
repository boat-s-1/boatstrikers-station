# PR #298 — staged production cutover and rollback checklist

**Status: HOLD / approval required.** This document is a proposed operator runbook, not authorization to execute any production mutation. Existing production Cron remains unchanged.

## Preflight (read-only)

1. Pin candidate commit SHA, both CI run URLs, exact deployed function definitions and current Cron job ID/schedule/command. Capture their SHA-256 digests.
2. Run `PR298-PRODUCTION-READONLY-READINESS.sql`. The current system is already in a failing persisted-data state; do not confuse an existing gap with a new regression.
3. Independently fetch and inspect a complete official `today.json` payload: JST date, all 24 stadium IDs where present, every race's six unique racer IDs, preview/results optionality and numeric conversions. Compare payload count to candidate flattening. Never treat a synthetic payload as proof of this gate.
4. Test all nine production trigger bodies and their side-effect tables in a disposable, production-equivalent schema with sanitized representative rows. Benchmark the Ichika evaluator's repeated whole-day scans at peak volume.
5. Confirm invoking role, extension HTTP permissions, ACL, search_path, statement timeout, network error behavior, lock contention, and replay idempotency. No secrets in logs.
6. Establish an independent persisted-state observer for event/entry/result association and per-boat registration parity; the legacy success log is insufficient.

## Proposed deployment sequence (requires separate explicit approval)

1. Save exact current function/Cron definitions and documented reversal SQL outside the production database.
2. Install only the new candidate RPC/caller with restrictive EXECUTE permissions. **Do not repoint Cron yet.** Verify catalog definitions and privileges without invoking the write RPC.
3. At a controlled, staffed window, pause or redirect the existing Cron only after confirming no in-flight run. Avoid concurrent old/new writers.
4. Make a single monitored new-caller invocation for a limited verified schedule, only if the caller supports safe scoping and all production-equivalent tests have passed. Current caller fetches the entire day, so this gate is **NOT MET**.
5. Verify exact persisted event/entry counts, six boat identities per race, results, alert side effects, first-seen rows, duration, and error logs. Any discrepancy is STOP.
6. Only after a successful controlled run and explicit go-ahead, switch the Cron command to the candidate. Keep post-cutover monitoring and a staffed rollback window.

## Abort and rollback

- On invalid official payload, any missing/mismatched boat, unexpected trigger fan-out, excessive duration, permission error, duplicate/concurrent run, or unverified result: **do not switch**.
- If Cron has been changed: disable the candidate schedule and restore the exact saved old Cron command/schedule using a reviewed transaction; verify only one active job.
- Preserve the new RPC for forensic analysis or revoke its execution after rollback, as approved. Do not delete potentially useful records automatically.
- **Restoring Cron does not reverse committed database writes.** Historical result-only data must be repaired under a separate approved, idempotent backfill plan; never delete production rows to mimic a rollback.
- Capture post-rollback counts and a read-only health check, document the incident and retain audit logs.

## Outstanding hard blockers

- Representative official payload and live caller compatibility are not verified.
- Full production trigger graph, real evaluator performance and alert side effects not verified.
- Candidate does not yet support a limited one-race or one-course canary; the current caller processes the full daily schedule.
- No approved and verified production rollback transaction or explicit production-change authorization.

**No production database, Cron, Vercel, PR merge or paid resource mutation is authorized by this document.**
