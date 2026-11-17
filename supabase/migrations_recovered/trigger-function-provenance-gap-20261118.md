# Trigger/function provenance gap — 2026-11-18

Read-only PostgreSQL catalog and 133 migration statement text scans.

## Trigger inventory
Five race-related tables have 12 noninternal triggers: bs_ai_predictions 3, bs_race_entries 6, bs_race_events 2, bs_race_results 1, bs_race_result_entries 0. These reference 10 distinct public functions. All 12 are currently enabled (`tgenabled='O'`).

| Trigger function | Migration name mentions | First version |
|---|---:|---|
| bs_set_updated_at | **0** | none detected |
| bs_guard_exhibition_write | 2 | 20260828131040 |
| bs_reconcile_bootstrap_entry | 1 | 20260923153044 |
| bs_reconcile_bootstrap_event_after_entry | 1 | 20260923153044 |
| bs_track_ai_first_seen | 1 | 20260907131347 |
| bs_track_entry_first_seen | 1 | 20260907131347 |
| bs_track_result_first_seen | 1 | 20260907131347 |
| trigger_evaluate_ichika_escape_surge_alerts | 1 | 20260830182657 |
| bs_settle_theory_recommendations_from_event | 2 | 20260905233001 |
| bsc_freeze_published_ai_bets | 3 | 20260912224638 |

`bs_set_updated_at` is invoked by `bs_ai_predictions_set_updated_at`, `bs_race_entries_set_updated_at`, `bs_race_events_set_updated_at`. Its source/provenance is not established by registered migration name scan. Do **not** invent function body or security mode.

## Unique constraint provenance
Four names `bs_race_events_unique`, `bs_race_events_race_unique`, `bs_ai_predictions_public_unique`, and `bs_ai_predictions_race_date_course_code_race_no_character_c_key` were absent from literal searches over all 133 migration statements. Their creation chronology remains unknown. A constraint may have been created with an unnamed SQL clause, yielding an automatic name, or by another bootstrap path.

## Gate
Current catalog state does not prove initial state. Reconstruct baseline functions, constraints, and grants only from reliable source or separately reviewed explicit hypotheses. No production writes, paid branch, Cron changes or PR modifications.
