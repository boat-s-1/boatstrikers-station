# PR #298 — completeness-v3 isolated integration matrix

Candidate installation order (isolated DB only):
1. `completeness-v3-unified-quality-rows.candidate.sql`
2. `completeness-v3-summary.candidate.sql`
3. `completeness-v3-recorder.candidate.sql`

Never run the recorder on production or on a shared PR #294 branch. The recorder writes alert and sync-log rows and calls pg_notify.

## Required tests before activation

| Case | Setup | Expected |
|---|---|---|
| 1 | Event+6 entries+complete result | No new issue; existing V2 parity |
| 2 | Result exists, no event or entries | One critical issue per real race key with base_event and entries |
| 3 | Result exists, no event, 6 entries | One critical base_event issue; do not duplicate |
| 4 | Event exists, only 5 entries | Existing entries issue preserved |
| 5 | Event exists, result missing | Existing result/payout issues preserved |
| 6 | Cancelled event | Existing cancelled semantics preserved |
| 7 | Run V3 recorder twice | One alert per race key; first_detected_at unchanged |
| 8 | Restore event and complete entries, exhibition, starts and payout | Alert resolved only when unified issue clears |
| 9 | Restore event but leave entries incomplete | Alert remains active with updated missing_fields |
| 10 | Concurrent V2 recorder | **HOLD**: existing V2 resolution can prematurely resolve V3 result-only alerts; do not run concurrently |
| 11 | Future/invalid date | Reject before writes |
| 12 | anon/authenticated | No EXECUTE privilege for candidate functions |
| 13 | All tables empty, official races unknown | is_complete=false; no invented race keys |
| 14 | Partial day with missing race results | Do not falsely mark complete; compare official schedule |

## Open implementation hazards

- `bs_record_race_data_completeness_v3_candidate` is SECURITY INVOKER. The dedicated test/scheduler role needs explicit table privileges and access to the existing quality function. Do not solve this by silently changing to SECURITY DEFINER.
- Current V2 recorder and candidate V3 recorder share `bs_race_data_quality_alerts`. Do not schedule both against the same day until cutover logic is designed.
- Existing alert `first_detected_at` is preserved by the UPSERT; verify actual PostgreSQL behavior.
- Alert `pg_notify` is a database notification, not proof of an external message delivery.
- Candidate functions compiled and basic idempotency/repair lifecycle were tested on an isolated **minimal fixture schema**. Full production-schema trigger effects, concurrency, pg_notify consumer delivery and end-to-end source ingestion remain unverified.
- Before any production rollout, prepare transactionally coordinated V3 summary+recorder cutover, rollback plan, monitoring, and explicit approval.

**Status (2026-11-17):** Three candidate functions successfully installed and invoked in isolated Supabase PostgreSQL branch `ojdkrmfsujojkozrnuwc`, using two synthetic race keys. Result-only issue detection, first alert insert, repeated recorder without duplicate alert, partial repair retaining alert, full repair resolving alert, and function EXECUTE privileges passed. The disposable branch was deleted and absence verified. **Not yet tested:** real source bootstrap trigger side effects, high-volume/concurrent writes, pg_notify consumer delivery, complete production-schema parity, production cutover. PR remains Draft/HOLD.
