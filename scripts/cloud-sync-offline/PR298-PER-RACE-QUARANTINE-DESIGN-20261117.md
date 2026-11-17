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

## Additional production function evidence (read-only, 2026-11-17)

Inspected `pg_get_functiondef` for `public.bs_apply_openapi_results` and `public.bs_settle_theory_recommendations_from_event` (no execution or write).

- `bs_apply_openapi_results` upserts `bs_race_results` using `coalesce(excluded.trifecta_result, bs_race_results.trifecta_result)` and analogous expressions for payout and finishing boats. **An incoming non-null result can overwrite an existing confirmed result**, even though `result_status` retains the existing value. A blanket claim that historical/confirmed results cannot be overwritten is **not established**.
- It also updates `bs_race_events.trifecta` and `trifecta_payout`, potentially firing the recommendation settlement trigger.
- `bs_settle_theory_recommendations_from_event` skips only when `new.trifecta IS NULL`; otherwise it calls `bs_settle_theory_recommendation` for non-settled recommendations. Its called function and any external side effects still require inspection.
- A quarantined result omitted from `p_results` will not directly invoke result updates for that race in this function, but consumers may still see an older confirmed result; **quarantine cannot be represented merely by absence**.

**New mandatory gate:** implement and test an explicit immutable-confirmed-result conflict policy, including comparison of existing confirmed values and provider capture timestamp. Reject conflicts without rewriting historical outcomes; record an observable conflict. Test one existing confirmed result with contradictory incoming non-null result and verify no change, including downstream settlement. Do not deploy until this is resolved.

## Candidate preflight guard (2026-11-17)

Commits `ef34b8ca`, `8a45e9e7`, `9b6c9af5` add a pre-writer conflict check in `bs_apply_openapi_atomic_candidate` against both `bs_race_results` and `bs_race_events` for **non-null trifecta combination and trifecta payout**. An isolated fixture asserts that contradictory values raise an error before any dependent writer is called and preserve existing rows. **CI verification pending at documentation time.**

This is deliberately a narrow safeguard, **not complete result immutability**. Remaining risks include first/second/third boats, other payout types, technique fields, result-entry positions, existing source priority, and concurrent writers that do not use the same advisory lock. The check runs after the candidate advisory lock, but it cannot protect against independent legacy writers. These must be resolved before cutover. The quarantine design remains unimplemented.

## Expanded persisted-result preflight (2026-11-17)

At `9e787919`, both CI workflows passed after adding comparisons for scalar exacta/quinella/trio combinations and payouts, first/second/third boat, winning method and technique. At `1863c837` and `c761e208`, the candidate additionally checks existing `bs_race_entries` arrival order, finish place, actual course, actual ST (including `actual_start_timing`) and result note before the four writers, with two synthetic conflict fixtures. **The boat-level CI was still pending at this document update.**

These guards are **preflight only** and do not guarantee serializability against independent legacy writers, which may write after the check. Also verify non-null value normalization, result source priority, and how a legitimate official correction should be handled. Do not infer authorization to change production from fixture success.

## Concurrent legacy writer audit and retry fixtures (2026-11-17)

Production **read-only** `pg_proc` inspection of `bs_apply_openapi_bootstrap`, `bs_apply_openapi_preview`, `bs_apply_openapi_preview_events`, `bs_apply_openapi_results`, and `bs_sync_openapi_today` found **no textual `pg_advisory` or `FOR UPDATE` reference in their function definitions**. This does not prove there is no concurrency control elsewhere (e.g., nested functions, row-level locks or external schedulers), but the candidate's advisory lock is not demonstrably shared with legacy entry points. Existing result and bootstrap functions do use upserts. Therefore a candidate preflight guard is **not** a complete cross-writer immutability guarantee.

At commit `ebc1ebef`, isolated PostgreSQL assertions now additionally cover an event-side quinella conflict and an identical-result retry (idempotent acceptance at the wrapper level). **CI status must be checked before treating these assertions as verified.** The fixture uses stub writers and does not establish production-level idempotence or alert/settlement side-effect safety.

**Cutover requirement:** inventory all writers and schedulers, verify they can be quiesced, explicitly stop old Cron before activating new Cron, check for in-flight work, and verify rollback can restore the previous schedule without overlapping writes. A production-compatible transaction/locking design and source-priority policy are required; do not disable production services under this draft.
