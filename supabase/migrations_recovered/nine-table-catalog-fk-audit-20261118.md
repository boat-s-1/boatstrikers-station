# Nine baseline-candidate tables — catalog and foreign-key audit (2026-11-18)

## Scope
Production PostgreSQL catalog SELECTs only. All nine are ordinary public tables with RLS enabled. Counts are current production schema, **not** historical baseline. No user rows, credentials, or function bodies extracted.

| Table | Columns | Constraints | Indexes | Policies | Noninternal triggers |
|---|---:|---:|---:|---:|---:|
| bs_ai_bet_results | 22 | 5 | 5 | 0 | 2 |
| bs_ai_predictions | 27 | 6 | 10 | 6 | 3 |
| bs_member_notification_preferences | 10 | 2 | 1 | 3 | 0 |
| bs_news_candidates | 32 | 9 | 7 | 0 | 0 |
| bs_race_entries | 107 | 7 | 10 | 2 | 6 |
| bs_race_events | 56 | 6 | 6 | 2 | 2 |
| bs_race_result_entries | 17 | 2 | 3 | 2 | 0 |
| bs_race_results | 18 | 2 | 3 | 2 | 1 |
| bsc_results | 14 | 1 | 2 | 1 | 0 |

## Foreign keys originating from these nine tables
- `bs_ai_predictions_race_event_fk`: `bs_ai_predictions` -> `bs_race_events`
- `bs_race_entries_event_fk`: `bs_race_entries` -> `bs_race_events`
- `bs_member_notification_preferences_user_id_fkey`: `bs_member_notification_preferences` -> `auth.users`

## Security and replay implications
- `bs_ai_bet_results` and `bs_news_candidates` have RLS enabled with zero policies. Do not invent public read policies.
- FK creation requires referenced tables first, or constraints must be applied after the tables exist.
- The current catalog does not reveal which columns, triggers or policies existed before migration version `20260819205859`.
- Do not use today's complete schemas as unreviewed bootstrap definitions: later migration ALTER TABLE operations can collide, and SECURITY DEFINER functions/ACLs require dedicated review.
- This document does not authorize production changes, Cron operations, branch creation, or replay. Offline staged validation and a separate billable-branch authorization are still required.
