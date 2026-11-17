-- PR #298 historical gap baseline. Read-only; never backfills or changes alerts.
-- Run before/after separately approved backfill; do not infer repaired rows
-- from a result count alone.
WITH result_keys AS (
 SELECT race_date,course_code,race_no
 FROM public.bs_race_results
 WHERE race_date BETWEEN DATE '2026-11-13' AND DATE '2026-11-16'
), gaps AS (
 SELECT r.race_date,r.course_code,r.race_no,
  (e.race_date IS NULL) AS event_missing,
  (SELECT count(*) FROM public.bs_race_entries x
   WHERE x.race_date=r.race_date AND x.course_code=r.course_code
     AND x.race_no=r.race_no) AS entry_count
 FROM result_keys r
 LEFT JOIN public.bs_race_events e USING(race_date,course_code,race_no)
)
SELECT race_date,count(*) result_races,
 count(*) FILTER (WHERE event_missing) missing_events,
 count(*) FILTER (WHERE entry_count=0) races_with_no_entries,
 count(*) FILTER (WHERE entry_count<>6) races_without_six_entries,
 sum(greatest(0,6-entry_count)) missing_entry_slots,
 CASE WHEN bool_and(NOT event_missing AND entry_count=6)
   THEN 'REPAIRED_REVIEW_REQUIRED' ELSE 'HOLD' END AS historical_backfill_gate
FROM gaps GROUP BY race_date ORDER BY race_date;
