# PR #298 — Quarantine implementation gates and executable acceptance matrix

Date: 2026-11-17. **Design and acceptance criteria only**; do not run this plan against production or install schema/functions without separate authorization.

## Objective

Allow a snapshot with one valid race and one race whose **program is valid but result is unrepresentable** to preserve both six-boat programs while refusing only the unsafe result, with explicit auditable quarantine. The current implementation rejects the whole snapshot and remains the safe default.

## Classification and atomicity contract

1. Fetch source **once**. Capture a UTC timestamp and SHA-256 of the raw response. Validate top-level shape, all stadium/race identities, JST date and six racer identities for every race. Any invalid program, stale source, missing date, duplicate key or ambiguous race identity rejects the **entire** snapshot before writes.
2. Classify each program-valid race's preview and result separately as `ACCEPT`, `PENDING`, or `QUARANTINE`. `PENDING` means no result supplied; `QUARANTINE` means result supplied but unsafe (dead heat, multiple payouts, malformed amount, conflicting persisted result, incomplete combination/payout). Never silently convert a malformed result into `PENDING`.
3. Produce an immutable manifest keyed by `(race_date,course_code,race_no,source_sha256)`, with `program_status`, `preview_status`, `result_status`, reason code, redacted JSON path and capture time. Do not store raw racer details or credentials in the quarantine log.
4. Call the atomic writer **once** with complete validated program arrays for all races, and preview/result arrays for ACCEPT layers only. Insert quarantine manifest rows **in the same PostgreSQL transaction** as those writes. A manifest write failure must roll back all data writes. Existing `bs_apply_openapi_atomic_candidate` does not accept a manifest: implementation requires a new reviewed wrapper/signature or a carefully controlled caller transaction, not a silent drop-in filter.
5. Quarantined results must block theory settlement/notification for the affected race and must not overwrite existing confirmed result fields. If an old confirmed result exists, a new conflicting source is an **explicit conflict** requiring resolution, not permission to suppress or change history.
6. Replay must compare source identity and status, preserve original evidence, and use explicit allowed transitions `QUARANTINE -> ACCEPT` after correction. Do not replay source snapshots that would regress a confirmed race. Duplicate Cron invocations must be idempotent.
7. The candidate date-scoped advisory lock does not coordinate with legacy writers. Verify quiescence and legacy job coordination independently before any cutover.

## Proposed quarantine ledger (schema proposal, not migration)

- `race_date date NOT NULL`, `course_code smallint NOT NULL`, `race_no smallint NOT NULL`
- `source_sha256 text NOT NULL` (64 lowercase hex), `captured_at timestamptz NOT NULL`
- `program_status text NOT NULL`, `preview_status text NOT NULL`, `result_status text NOT NULL` with CHECK enums
- `reason_code text`, `redacted_field_path text`, `resolved_at timestamptz`, `resolution_note text`
- Unique key on `(race_date,course_code,race_no,source_sha256)`; do not key on race alone, because corrected source versions must be traceable
- Restrict inserts/updates to a dedicated trusted ingestion role; deny PUBLIC, anon and authenticated writes, define RLS and retention explicitly; no sensitive raw response or token in rows
- Determine whether a separate immutable audit table is needed for transitions rather than overwriting ledger state

**Migration gate:** production has more migrations than repository; reconcile 133 live versus 56 repository migrations and review existing schema/table names before drafting executable DDL.

## Acceptance matrix (isolated PostgreSQL only)

| ID | Synthetic input | Required outcome |
|---|---|---|
| Q01 | Valid race A + valid race B | Both programs and 12 entries persist; valid layers settle once |
| Q02 | Valid A + B valid program, two trifecta payouts | Both programs and 12 entries persist; only A result written; B ledger says QUARANTINE |
| Q03 | Valid A + B missing racer | Entire transaction fails; no events, entries, settlement or ledger success marker |
| Q04 | Valid A + B result combination without payout | B QUARANTINE; B not settled with zero payout |
| Q05 | B conflicting with already confirmed result | Existing result unchanged; conflict ledger entry; no B resettlement |
| Q06 | Same source SHA replay twice | No duplicate rows, alerts, settlements or ledger transitions |
| Q07 | Trigger failure during A writer | Entire transaction rolls back, including ledger and B program |
| Q08 | Quarantine ledger insert failure | Entire transaction rolls back, including all events and entries |
| Q09 | Corrected B result arrives later | Explicit QUARANTINE -> ACCEPT transition, original record retained |
| Q10 | Concurrent candidate calls + active legacy backfill | No stale preflight overwrite or duplicate settlement; if cannot prove, HOLD |
| Q11 | Upstream 429/500/503, invalid JSON, stale date | No writes; classified health failure without success marker |
| Q12 | Valid snapshot with preview from future timestamp | Do not leak post-race data into pre-race predictions; require provenance policy |

## Release gates

- Provider data rights and live payload verified (not inferred from MIT source-code license).
- Production-equivalent triggers and load tested; source priority and official corrections policy approved.
- Migration parity, security grants/RLS, retention and rollback independently reviewed.
- New quarantine implementation and Q01–Q12 pass on disposable database.
- Owner explicitly authorizes each production migration, Cron cutover and any paid resource.

**Current decision: HOLD.** This document creates no quarantine table and does not claim implementation.

## Live RLS baseline (read-only)

A SELECT-only query of `pg_tables` confirms `rowsecurity=true` on all four related public tables: `bs_race_events`, `bs_race_entries`, `bs_race_results`, and `bs_theory_recommendations`. This is only an RLS-enable flag; **it does not prove the policies or grants are safe**. A quarantine ledger must receive explicit, independently reviewed policies and grants rather than assuming it inherits protection.

## First pure classifier prototype (2026-11-17)

Files `openapi-result-quarantine.prototype.mjs` and `openapi-result-quarantine.prototype.test.mjs` were added on the Draft PR branch (commits `9de474ca`, `5293b92a`, `58557069`). They implement a **pure, offline result-layer classifier** and synthetic tests for pending, accepted, multi-payout, malformed payout, missing finish, tied finish, mixed good/bad results and non-mutation. The test workflow is configured to run `scripts/cloud-sync-offline/*.test.mjs`; verify CI status before claiming PASS.

**Not implemented:** full race/program gate, strict source identity/date validation, canonical payout combination validation, quarantine ledger/DDL/RLS, transactional writer integration, triggers/settlement suppression, replay, concurrency control and real provider data. The classifier must **not** be used to bypass the existing fail-closed caller. A returned `ACCEPT` is not authorization to write without the other gates. Q01–Q12 remain unproven end-to-end.

## Classifier hardening (2026-11-17)

Pure prototype now rejects payout values outside JavaScript's safe integer range and finish racer keys/positions outside 1–6. Commits `b1a4c7a2` and `19e3a340` add implementation and tests. This remains an **offline prototype**. It is not the SQL caller's canonical validator, is not integrated with an atomic quarantine ledger, and does not validate every possible provider field. Its ACCEPT result is not a standalone production-write permission.
