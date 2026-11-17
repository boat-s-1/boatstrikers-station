# PR298 — pre-cutover approval checklist (HOLD)

Updated 2026-11-17 (post-CI review). This is a decision checklist, not an authorization to deploy.

## Verified in disposable CI

- Offline parser/contract and PostgreSQL isolated workflow PASS at `36460880`.
- Simulated 1-race/6-boat payload maps to one event and six entries.
- Synthetic preview, four payout types and settled race positions are asserted.
- Malformed numeric program, preview, result and payout inputs fail before writer call.
- HTTP 429/500/503, invalid JSON, malformed root shapes, multi-race invalid input, preview/result identity mismatch, dead-heat/multi-payout, and payout shape negative cases have isolated coverage.
- At `40cd4198`, both CI workflows PASS: offline `44100687169`, PostgreSQL `44100687175`.
- The published schema locates `stadium_number` inside each race; the SQL and all known runtime/negative/settled fixtures were aligned, with both workflows passing at `131cf3d9`.
- **Caution:** full-day fail-closed validation rejects an entire batch when any one race has an unrepresentable tied result or multi-payout. This protects consistency but can block otherwise valid program updates. Before deployment decide on an explicit quarantine/split-batch strategy with observability, not silent dropping.
- No network request is made by these CI fixtures; HTTP responses are stubbed.

## Production read-only evidence

- 2026-11-13 through 2026-11-17: 732 confirmed result rows with trifecta; all 732 lack corresponding event and all six entries. See `PR298-PRODUCTION-GAP-RECHECK-20261117.md`.
- Production Ichika evaluator source was compared with simplified fixture; see `PR298-ICHIKA-PRODUCTION-FUNCTION-COMPARISON.md`.

## Required before production cutover

1. **Data license:** document source-provider permission for program, preview, result ingestion and downstream publication. The repository's MIT *software* license is not proof of data rights.
2. **Actual payload:** acquire a legitimately permitted, time-stamped sample; redact personal/secret values as needed. Verify stadium/race keys, 6 racers, date, all preview and result shapes against SQL candidate; record discrepancies. CI's synthetic JSON is not evidence of provider compatibility.
3. **Production DB parity:** reconcile 56 repository migrations against 133 live migrations; inventory triggers, privileges, RLS, functions and extensions before any DDL or branch migration.
4. **Load/rollback:** test the actual production-equivalent triggers and full-day transaction in an isolated environment. 144-race fixture timing is not a production benchmark.
5. **Operational safety:** document timeout, stale feed handling, retries, alert/notification side effects, health checks and rollback to current Cron; ensure historical results are never overwritten.
6. **Explicit approval:** review the exact SQL diff, target project, expected cost, deployment window and rollback plan before production RPC installation or Cron repointing.

## Decision

**HOLD.** Do not modify production, deploy Vercel, alter Cron, use paid branches, backfill historical entries or change Windows processes under this checklist.
