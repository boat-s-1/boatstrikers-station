# PR #298 — production missing base-row diagnosis (read-only, 2026-11-17)

## Evidence

Read-only production counts (project `rzosrbkyniyedolhkgxo`):

| JST date | bs_race_results | bs_race_events | bs_race_entries |
|---|---:|---:|---:|
| 2026-11-12 | 155 | 156 | 936 |
| 2026-11-13 | 156 | 0 | 0 |
| 2026-11-14 | 168 | 0 | 0 |
| 2026-11-15 | 156 | 0 | 0 |
| 2026-11-16 | 120 | 0 | 0 |
| 2026-11-17 (at query time) | 0 | 0 | 0 |

Missing base data across 11/13–16: **600 races and 3,600 expected six-boat entries**, while results exist. 11/12 base rows have null `data_source` (156 events and 936 entries), so their original collector cannot be established from that field alone.

## Confirmed structural cause in the existing production sync function

Read-only `pg_get_functiondef(public.bs_sync_openapi_today())` shows:

- The function fetches `https://boatraceopenapi.github.io/api/v1/today.json` during its JST 07:00–23:30 window.
- It parses preview rows, event preview rows, race results and result racer rows.
- It calls `bs_apply_openapi_preview`, `bs_apply_openapi_preview_events`, and `bs_apply_openapi_results`.
- **It never invokes `bs_apply_openapi_bootstrap` or constructs complete six-boat program base-row payloads.** Thus this existing collector cannot by itself fill missing `bs_race_events` and `bs_race_entries` from the program manifest.

This is a **confirmed code-path gap**, not proof that no other independent collector ever runs or an explanation of every operational failure. The specific 11/12-to-11/13 change still requires scheduler/source log and deployment history review.

## Safe remediation path

1. Keep existing production sync and results collection unchanged.
2. Finish isolated alert-trigger fan-out and replay/idempotency verification before enabling PR #298's current-day bootstrap.
3. Validate official schedule/source parity and full six-boat program payloads.
4. Separately authorize historical 11/13–16 backfill only after verifying archival source and current-day-only route limitations.
5. Confirm BRDB/PC-KYOTEI priority and TRINITY immutable snapshots remain unchanged.
6. Enable scheduled collection only after observability and rollback plan are reviewed.

**Status: DRAFT / HOLD.** No production writes, trigger changes, scheduler changes or paid branches were made in this investigation.
