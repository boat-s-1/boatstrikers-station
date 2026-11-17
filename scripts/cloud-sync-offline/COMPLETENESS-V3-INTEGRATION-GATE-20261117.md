# PR #298 — completeness-v3 integration gate

## Production schema verified (read-only)

`bs_race_data_quality_alerts` requires `race_date`, `course_code`, `race_no`, `severity` (warning/critical), `status` (active/resolved), `missing_fields` text[], `detail` jsonb and timestamps. Unique key: `(race_date,course_code,race_no)`. Therefore missing result-anchored races can use **real** race keys without synthetic course 0/race 0 alerts. Existing alerts must be preserved and their `missing_fields` merged, not overwritten by a second independent UPSERT.

## Read-only per-race verification

`COMPLETENESS-V3-RESULT-ANCHOR-READONLY-20261117.sql` detects result keys without base events or without exactly six distinct 1–6 entry rows. Tested against production:

- 2026-11-12: 155 result races; 0 base-row gaps.
- 2026-11-13: 156 result races; 156 missing events.
- 2026-11-14: 168 result races; 168 missing events.
- 2026-11-15: 156 result races; 156 missing events.
- 2026-11-16: 120 result races; 120 missing events.

Total: **600** confirmed result-anchored missing-event race keys. Entry completeness is not separately evaluated when its base event is missing; recovery must populate both.

## Safe integration design

1. Build the completeness-v3 per-race issue set from a **union** of event-anchored `bs_race_data_quality_rows` and result-anchored keys, deduplicated by date/course/race. Do not replace event-anchored checks: some scheduled races have no results (cancelled or pending).
2. Merge missing fields into a single row per race. If result exists but base event is absent, include `base_event` and `entries`. Preserve current fields such as `result`, `payout`, `result_detail` when applicable.
3. Update `bs_race_data_completeness` and `bs_record_race_data_completeness` together on an isolated branch. Preserve the existing `partial` status and `pg_notify('boatstrikers_data_quality_alert', ...)` contract, but ensure `issue_count` reflects missing base races.
4. Alert upserts should keep existing `first_detected_at`, avoid duplicate alerts on retry, and resolve only after the **unified** issue set is clear. Current resolution logic relies solely on `bs_race_data_quality_rows` and would incorrectly resolve new result-anchored alerts if left unchanged.
5. For dates with no result rows and no event rows, mark schedule parity `UNKNOWN` unless independently verified against official scheduled races. Never mark them complete solely because issue count is zero.
6. Test a day with 6-boat event rows and no result, result-only day, mixed day, cancelled race, missing one entry, repeated runs, alert resolution, and notification counts in isolation. Review execution privileges of any SECURITY DEFINER function before deployment.

**No production function, alert table, notification, cron or deployment was changed.**
