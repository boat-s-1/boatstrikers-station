# PR #298 — Windows-free cutover acceptance checklist

Status: **HOLD**. This is a review checklist, not authorization to change production.

## 1. Verified production read-only baseline (2026-11-17)
The query `PR298-PRODUCTION-READONLY-WINDOWS-DEPENDENCY-GAP.sql` was executed on production. Counts by JST date:

| Date | Program events | Program boats | Results | Trifecta payouts | Gate |
|---|---:|---:|---:|---:|---|
| 11/11 | 144 | 864 | 144 | 144 | COUNT-ONLY PASS |
| 11/12 | 156 | 936 | 155 | 155 | COUNT-ONLY PASS |
| 11/13 | 0 | 0 | 156 | 156 | HOLD |
| 11/14 | 0 | 0 | 168 | 168 | HOLD |
| 11/15 | 0 | 0 | 156 | 156 | HOLD |
| 11/16 | 0 | 0 | 120 | 120 | HOLD |
| 11/17 | 0 | 0 | 119 | 119 | HOLD, intraday |

11/13–17 gate is `HOLD: results without program`. This query **does not** establish official race-manifest completeness, individual six-boat identities, source permissions, or preview data freshness.

## 2. Required evidence before cloud cutover
- [ ] Identify BRDB Q011 SQL changes and provider-approved frequency. Do not resume five-minute polling.
- [ ] Obtain PC-KYOTEI task/script inventory, export feasibility, license and redistribution conditions; no restart of Windows task.
- [ ] Establish that OpenAPI program collection is authoritative enough for all intended races and that its own usage terms permit the planned cadence.
- [ ] Test **per-race** six unique boat numbers and six valid unique registration numbers; compare against independently trusted schedule where available.
- [ ] Verify all production-equivalent triggers (especially Ichika exhibition alert fan-out), permissions, lock contention, idempotent retries and rollback in isolated PostgreSQL.
- [ ] Confirm how the existing results and payouts remain unchanged during baseline backfill.
- [ ] Define which downstream AI/alert jobs were previously launched by Windows v7 and replace or explicitly defer each.
- [ ] Avoid dual pollers: plan a single fetcher and a source-specific rate-limit budget.
- [ ] Require explicit operator approval for production DB/Cron/Vercel changes and a monitored rollback procedure.

## 3. Proposed minimal, safe rollout
1. Read-only source and database parity audit; collect no new API traffic until source terms reviewed.
2. Offline fixtures with representative real payload and missing-race negative cases.
3. Disposable PostgreSQL write test (not production) using real trigger definitions, checking exactly-once semantics and rollback.
4. Controlled, explicitly approved production canary **only if implementation supports scope limiting**. Current all-day candidate must not be represented as a one-race canary.
5. Validate persisted race/boat identities and existing payouts after canary, then separately approve full cutover.

## 4. Current known stop reasons
- No verified PC-KYOTEI replacement or licensing determination.
- No provider-approved BRDB schedule/Q011 fix.
- No proven production-equivalent trigger load test or all-day schedule parity.
- No safe limited-scope canary in the existing candidate.

**No production writes or job changes were made.**
