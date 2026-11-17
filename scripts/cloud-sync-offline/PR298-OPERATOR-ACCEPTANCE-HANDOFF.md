# PR298 — Operator acceptance and approval boundaries

**Draft / HOLD. No deployment or production mutation is authorized by this document.**

## Ready for review
- Candidate atomic current-day OpenAPI function with program bootstrap and dependent writers in one transaction.
- Candidate historical program-only function, limited to 2026-11-13–17 and already confirmed results.
- PostgreSQL fixture and offline contract CI, including rejected partial programs, malformed keys and batch rollback.
- Read-only daily continuity audit, exact historical race allowlist and classified preflight.
- Source-evidence manifest, archive rights gates, feed replacement matrix and staged cutover plan.

## Not ready / missing external evidence
1. Verified source and license for archived historical program files, including per-file hashes.
2. Production-compatible schema and trigger dependency test; fixture CI alone is insufficient.
3. Current-day official schedule parity and six-boat registration parity for the proposed cloud source.
4. Full inventory of exhibition and BRDB-specific fields currently supplied by Windows.
5. Privileged production caller, rate limits, one-writer fencing and operational rollback.
6. Explicit approval for **each** production action: install SQL, enable/change Cron,
   deploy Vercel, backfill history, and eventually disable Windows.

## Decision matrix

| Action | Current status | Next evidence |
|---|---|---|
| Merge Draft PR | HOLD | Review and integration approval |
| Install current-day atomic RPC | HOLD | Schema, source and security parity |
| Change production Cron | HOLD | One-writer rollback/fencing and approval |
| Backfill historical program | HOLD | Source rights and per-race verified archives |
| Switch off Windows | HOLD | All critical feed replacements and multi-day cloud parity |
| Read-only SQL checks | GO | Use SELECT-only queries; do not invoke writer RPCs |
| Isolated GitHub development and CI | GO | Keep production secrets/data out of logs |

## Operator handoff
Review `PR298-CLOUD-CUTOVER-STAGED-GATES.md`,
`PR298-CLOUD-FEED-REPLACEMENT-MATRIX.md`,
`PR298-HISTORICAL-RESTORE-GO-HOLD.md` and
`PR298-HISTORICAL-SOURCE-EVIDENCE-MANIFEST.md`.
The next productive work should obtain external source evidence and validate
production-compatible dependencies, **not** relax safety checks to force a
production backfill.
