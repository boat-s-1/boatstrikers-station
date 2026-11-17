-- PR #298: READ ONLY operational diagnostics for missing base race data.
-- This file contains SELECT statements only. It does not invoke RPCs or modify data.
-- Change date bounds deliberately; do not infer official schedule completeness from results.
WITH results AS (
  SELECT race_date, course_code, race_no, result_status
  FROM public.bs_race_results
  WHERE race_date BETWEEN DATE '2026-11-13' AND DATE '2026-11-17'
), events AS (
  SELECT race_date, course_code, race_no, race_status
  FROM public.bs_race_events
  WHERE race_date BETWEEN DATE '2026-11-13' AND DATE '2026-11-17'
), entry_counts AS (
  SELECT race_date, course_code, race_no,
         count(*) AS entries,
         count(DISTINCT boat_no) AS distinct_boats
  FROM public.bs_race_entries
  WHERE race_date BETWEEN DATE '2026-11-13' AND DATE '2026-11-17'
  GROUP BY 1,2,3
), keys AS (
  SELECT race_date, course_code, race_no FROM results
  UNION
  SELECT race_date, course_code, race_no FROM events
)
SELECT k.race_date,
       count(*) AS observed_keys,
       count(*) FILTER (WHERE r.race_no IS NOT NULL) AS result_keys,
       count(*) FILTER (WHERE e.race_no IS NOT NULL) AS event_keys,
       count(*) FILTER (WHERE r.race_no IS NOT NULL AND e.race_no IS NULL) AS results_missing_events,
       count(*) FILTER (WHERE e.race_no IS NOT NULL AND COALESCE(a.entries,0) <> 6) AS events_without_six_entries,
       count(*) FILTER (WHERE e.race_no IS NOT NULL AND COALESCE(a.distinct_boats,0) <> 6) AS events_without_six_distinct_boats,
       count(*) FILTER (WHERE r.race_no IS NOT NULL AND e.race_no IS NOT NULL
          AND r.result_status = 'confirmed' AND e.race_status <> 'finished') AS confirmed_results_not_finished
FROM keys k
LEFT JOIN results r USING (race_date, course_code, race_no)
LEFT JOIN events e USING (race_date, course_code, race_no)
LEFT JOIN entry_counts a USING (race_date, course_code, race_no)
GROUP BY k.race_date ORDER BY k.race_date;

-- The first query intentionally counts only observed DB keys, NOT official scheduled races.
-- A zero row day can mean no source rows have arrived; it is not a healthy completion signal.
