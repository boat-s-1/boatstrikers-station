-- PR #298 production-safe SELECT-only bootstrap coverage diagnostic.
-- This query is intentionally independent of the official schedule; zero results
-- can mean either no races have settled yet or missing result ingestion.
WITH jst AS (
 SELECT (now() AT TIME ZONE 'Asia/Tokyo')::date AS today
), dates AS (
 SELECT (jst.today - offs)::date race_date FROM jst CROSS JOIN generate_series(0,7) offs
), daily AS (
 SELECT d.race_date,
  (SELECT count(*) FROM public.bs_race_events e WHERE e.race_date=d.race_date) AS event_rows,
  (SELECT count(*) FROM public.bs_race_entries e WHERE e.race_date=d.race_date) AS entry_rows,
  (SELECT count(*) FROM public.bs_race_results r WHERE r.race_date=d.race_date) AS result_rows,
  (SELECT count(*) FROM public.bs_race_results r WHERE r.race_date=d.race_date
   AND NOT EXISTS (SELECT 1 FROM public.bs_race_events e
     WHERE e.race_date=r.race_date AND e.course_code=r.course_code
     AND e.race_no=r.race_no)) AS result_without_event,
  (SELECT count(*) FROM public.bs_race_results r WHERE r.race_date=d.race_date
   AND (SELECT count(*) FROM public.bs_race_entries e
     WHERE e.race_date=r.race_date AND e.course_code=r.course_code
     AND e.race_no=r.race_no) <> 6) AS result_without_six_entries
 FROM dates d
)
SELECT race_date,event_rows,entry_rows,result_rows,
 result_without_event,result_without_six_entries,
 CASE WHEN result_rows=0 THEN 'NO_RESULT_BASELINE'
      WHEN result_without_event>0 OR result_without_six_entries>0 THEN 'RESULT_ONLY_GAP'
      ELSE 'RESULT_ANCHORED_COMPLETE' END AS diagnostic
FROM daily ORDER BY race_date DESC;
