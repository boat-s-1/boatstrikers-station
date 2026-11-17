# PR #298 — Per-race quarantine and atomicity decision (HOLD)

Date: 2026-11-17. Design only; **no production changes authorized**.

## Verified evidence

- Current Cron caller `openapi-atomic-cron-caller.candidate.sql` validates the entire `today.json` payload before passing arrays to `bs_apply_openapi_atomic_candidate`.
- The atomic writer requires `v_events > 0`, `v_entries = 6 * v_events`, and validates every dependent payload key; it serializes writes per JST date with an advisory transaction lock.
- Existing `bs_race_results` and `bs_race_events` payout/finishing columns are scalar; the caller rejects multi-payout/dead-heat shapes rather than silently truncating.
- Production read-only trigger inventory (2026-11-17): `bs_race_entries` has six user triggers (exhibition guard, updated_at, bootstrap entry reconciliation, event reconciliation, first-seen tracking, Ichika evaluator); `bs_race_events` has two (updated_at, theory recommendation settlement); `bs_race_results` has one (result first-seen tracking). These are **side-effect surfaces**, not a production load test.
- At commit `40cd4198`, both offline and isolated PostgreSQL workflows PASS (runs `44100687169` and `44100687175`).

## Why simply dropping the bad race is unsafe

1. A malformed program (wrong date, incomplete six racers, duplicate registration) is different from an otherwise valid program whose **result** is unrepresentable.
2. Dropping the whole race would also drop its valid six-boat program, potentially leaving the exact bootstrap gap PR #298 is intended to repair.
3. Dropping only a result without explicit quarantine metadata could appear to downstream consumers as an uncompleted race and cause misleading settlement.
4. A source response is a single time-stamped snapshot. Splitting its writes into separate independent transactions risks mixed versions of programs, preview and results.
5. Existing row triggers may evaluate alerts or settle recommendations; selective replay must not trigger duplicate external side effects.

## Proposed design — not implemented

**Phase A: fetch once and classify in memory.** Reject the *entire* snapshot if root structure, top-level date, stadium/race identities, schedule keys, or program completeness is invalid. Distinguish:
- `PROGRAM_INVALID`: no write, snapshot-level HOLD.
- `RESULT_UNREPRESENTABLE`: program and valid preview can be considered for ingestion; result is quarantined.
- `PREVIEW_INVALID`: program can be considered for ingestion; preview is quarantined.
- `SOURCE_UNAVAILABLE` / `SOURCE_STALE`: no write and emit a health signal.

**Phase B: validate an explicit per-race manifest.** Include `race_date`, `course_code`, `race_no`, `source_capture_at`, source checksum, per-layer status, rejection reason and field path; avoid secrets or unnecessary racer personal data in logs. No silent skips.

**Phase C: one transaction per validated snapshot.** Build *complete* program event and six-entry arrays for all valid races. Build preview/result arrays only for layer-valid races. Call the existing atomic writer once, with the same advisory lock and post-write verification. If any write/trigger fails, roll back the entire snapshot. Quarantine records and success markers must be committed consistently with the ingestion outcome, not in a separate best-effort log that can misreport success.

**Phase D: downstream safety.** Quarantined results must be distinguishable from `not yet resulted`; suppress settlement for quarantined results until an explicit replay after schema support or manual resolution. Require idempotent replay and verification of alerts and recommendation settlement. Avoid mutating an already confirmed official result.

## Mandatory design gates

1. Determine whether a quarantine ledger can be added without conflicting with the 133 live / 56 repository migration divergence. Specify RLS, grants, retention and ownership before DDL.
2. Verify whether `bs_apply_openapi_results` or any downstream settlement code treats missing result as a normal pending race. Inspect full function bodies and dependencies.
3. Test synthetic snapshot with **one valid race plus one valid-program/unrepresentable-result race**: both programs/six boats should persist, only valid result should settle, quarantine must be visible, no duplicate side effects. Also test invalid program aborts all writes.
4. Test duplicate Cron execution, overlapping Cron, partial trigger failure, stale upstream response, failed quarantine recording and replay after correction.
5. Benchmark production-equivalent trigger fan-out and inspect actual provider payload and data rights.

## Decision

Keep current strict **fail-closed** candidate unchanged until the quarantine ledger, transactional semantics, and downstream settlement invariants are implemented and proven. Do not deploy a split-batch shortcut. **HOLD** production DB/Cron/Vercel/Windows and paid infrastructure.
