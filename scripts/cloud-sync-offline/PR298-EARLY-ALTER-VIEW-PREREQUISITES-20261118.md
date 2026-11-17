# PR298 — correction: earliest view mention is not always creation (2026-11-18)

## Production migration SQL inspected read-only

- `20260901213035 public_race_views_security_invoker_phase3b`: SQL is **ALTER VIEW**, not CREATE VIEW:
  `alter view public.bs_v_race_detail set (security_invoker = true);`
  `alter view public.bs_v_today_courses set (security_invoker = true);`
  `alter view public.v_bs_race_page set (security_invoker = true);`
  Therefore **all three named views must already exist** by the time this migration executes, or it fails. Their historical creation provenance must be found separately.
- `20260905152357 create_elimination_training_views`: starts `create or replace view public.v_elimination_training_races as`; also mentions `v_elimination_training_entries`. Inspect the complete statement before concluding all definitions are included.
- `20260907145857 add_effective_race_result_confirmation_view`: starts `create or replace view public.v_bs_race_results_confirmed as`.
- `20260910194212 create_bs_x_night_candidates_view`: starts `create or replace view public.v_bs_x_night_candidates with (security_invoker = true) as`.

## Correction to previous chronology report

The earlier report `PR298-DEPENDENT-VIEWS-MIGRATION-CHRONOLOGY-20261118.md` only proved earliest **textual mention**; it must not be interpreted as proof that each view is created there. In particular, the 2026-09-01 ALTER VIEW is a **hard prerequisite** for `bs_v_race_detail`, `bs_v_today_courses`, and `v_bs_race_page` to exist before that migration. This widens the missing historical schema/provenance investigation beyond the five early tables.

## Gate

Do not prepend current-state view definitions without provenance: earlier schema may differ. No full migration replay demonstrated. PR Draft/HOLD; no production DB/Cron writes or paid branch.
