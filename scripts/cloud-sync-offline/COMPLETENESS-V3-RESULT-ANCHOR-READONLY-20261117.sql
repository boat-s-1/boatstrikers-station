-- PR #298: read-only per-race detection anchored on confirmed results.
-- Proposed input to a future completeness-v3; never call a mutating function.
-- Does not presume a day has races when neither results nor base events exist.
WITH result_keys AS (
 SELECT DISTINCT race_date,course_code,race_no
 FROM public.bs_race_results
 WHERE race_date BETWEEN date '2026-11-12' AND date '2026-11-16'
), event_keys AS (
 SELECT race_date,course_code,race_no
 FROM public.bs_race_events
 WHERE race_date BETWEEN date '2026-11-12' AND date '2026-11-16'
), entry_counts AS (
 SELECT race_date,course_code,race_no,count(*) AS boat_rows,
        count(DISTINCT boat_no) FILTER (WHERE boat_no BETWEEN 1 AND 6) AS distinct_boats
 FROM public.bs_race_entries
 WHERE race_date BETWEEN date '2026-11-12' AND date '2026-11-16'
 GROUP BY race_date,course_code,race_no
), missing AS (
 SELECT r.race_date,r.course_code,r.race_no,
        CASE WHEN ev.race_date IS NULL THEN 'base_event'
             WHEN coalesce(en.distinct_boats,0)<>6 OR coalesce(en.boat_rows,0)<>6 THEN 'six_boat_entries'
             ELSE NULL END AS missing_field
 FROM result_keys r
 LEFT JOIN event_keys ev USING(race_date,course_code,race_no)
 LEFT JOIN entry_counts en USING(race_date,course_code,race_no)
)
SELECT race_date, count(*) AS result_anchored_races,
       count(*) FILTER (WHERE missing_field='base_event') AS missing_event_races,
       count(*) FILTER (WHERE missing_field='six_boat_entries') AS missing_entry_races,
       count(*) FILTER (WHERE missing_field IS NOT NULL) AS critical_races
FROM missing GROUP BY race_date ORDER BY race_date;
