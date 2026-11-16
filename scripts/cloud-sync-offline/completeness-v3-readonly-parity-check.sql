-- READ ONLY: compare current v2 summary to a result-anchored v3 estimate without installing functions.
-- For each date, v3 should include all v2 event-anchored races plus result-only keys.
WITH dates AS (
 SELECT generate_series(date '2026-11-11',date '2026-11-16',interval '1 day')::date AS race_date
), event_quality AS (
 SELECT d.race_date,
        (public.bs_race_data_completeness(d.race_date)->>'races')::integer AS v2_races,
        (public.bs_race_data_completeness(d.race_date)->>'issue_count')::integer AS v2_issues
 FROM dates d
), result_only AS (
 SELECT r.race_date,count(*) AS additional_races
 FROM public.bs_race_results r
 WHERE r.race_date BETWEEN date '2026-11-11' AND date '2026-11-16'
   AND NOT EXISTS (
     SELECT 1 FROM public.bs_race_events e
     WHERE e.race_date=r.race_date AND e.course_code=r.course_code AND e.race_no=r.race_no
   )
 GROUP BY r.race_date
)
SELECT d.race_date,e.v2_races,e.v2_issues,coalesce(r.additional_races,0) AS missing_base_event_races,
       e.v2_races+coalesce(r.additional_races,0) AS v3_estimated_races,
       e.v2_issues+coalesce(r.additional_races,0) AS v3_estimated_issues
FROM dates d JOIN event_quality e USING(race_date)
LEFT JOIN result_only r USING(race_date) ORDER BY d.race_date;
