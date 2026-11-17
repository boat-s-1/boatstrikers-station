# PR298 — production read-only gap reconfirmation (2026-11-17)

Scope: production project `rzosrbkyniyedolhkgxo`. SQL SELECT only. No mutation.

Read-only query joined `bs_race_results` to `bs_race_events` and
`bs_race_entries` on `(race_date,course_code,race_no)`. A preliminary
query mistakenly addressed `result_status` on `bs_race_events` and
failed without changing data; the corrected query used `bs_race_results`.

| JST date | Confirmed results with trifecta | Missing event | Missing all entries |
| --- | ---: | ---: | ---: |
| 2026-11-13 | 156 | 156 | 156 |
| 2026-11-14 | 168 | 168 | 168 |
| 2026-11-15 | 156 | 156 | 156 |
| 2026-11-16 | 120 | 120 | 120 |
| 2026-11-17 | 132 | 132 | 132 |
| Total | **732** | **732** | **732** |

These counts establish the missing bootstrap symptom; they do not
authorize historical backfill or identify an approved source of
historical program data. Existing confirmed results must be preserved.

Additional verification: candidate `openapi-atomic-cron-settled.fixture.sql`
now asserts synthetic weather, wind, wave, air/water temperature, exhibition
timing/course/tilt and settled payout/placing values. Latest known
completed CI at commit `c1abf0be` was green for both workflows;
`b90bcd2f` was still being checked when this report was authored.

**HOLD**: live provider payload schema, data rights, production trigger
load and authorization for any production writes remain outstanding.
No production DB writes, Cron edits, Vercel operations or Windows changes.
