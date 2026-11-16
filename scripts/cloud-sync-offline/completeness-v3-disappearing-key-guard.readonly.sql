-- READ ONLY: independently check whether V3 recorder should refuse resolution.
-- This query intentionally does NOT invoke the recorder.
WITH dates AS (
 SELECT generate_series((now() AT TIME ZONE 'Asia/Tokyo')::date-7,
                        (now() AT TIME ZONE 'Asia/Tokyo')::date-1,
                        interval '1 day')::date AS race_date
), keys AS (
 SELECT race_date,course_code,race_no FROM public.bs_race_events
 WHERE race_date BETWEEN (now() AT TIME ZONE 'Asia/Tokyo')::date-7
                     AND (now() AT TIME ZONE 'Asia/Tokyo')::date-1
 UNION
 SELECT race_date,course_code,race_no FROM public.bs_race_results
 WHERE race_date BETWEEN (now() AT TIME ZONE 'Asia/Tokyo')::date-7
                     AND (now() AT TIME ZONE 'Asia/Tokyo')::date-1
), counts AS (
 SELECT race_date,count(*) AS anchored_races FROM keys GROUP BY race_date
), vanished AS (
 SELECT a.race_date,count(*) AS active_alerts_without_source_key
 FROM public.bs_race_data_quality_alerts a
 WHERE a.status='active'
   AND a.race_date BETWEEN (now() AT TIME ZONE 'Asia/Tokyo')::date-7
                       AND (now() AT TIME ZONE 'Asia/Tokyo')::date-1
   AND NOT EXISTS (SELECT 1 FROM keys k
                   WHERE k.race_date=a.race_date AND k.course_code=a.course_code
                     AND k.race_no=a.race_no)
 GROUP BY a.race_date
)
SELECT d.race_date,coalesce(c.anchored_races,0) AS anchored_races,
       coalesce(v.active_alerts_without_source_key,0) AS active_alerts_without_source_key,
       (coalesce(c.anchored_races,0)=0
        OR coalesce(v.active_alerts_without_source_key,0)>0) AS recorder_must_stop
FROM dates d LEFT JOIN counts c USING(race_date) LEFT JOIN vanished v USING(race_date)
ORDER BY d.race_date;
