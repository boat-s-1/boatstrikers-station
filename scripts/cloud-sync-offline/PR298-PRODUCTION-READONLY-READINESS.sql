-- PR #298 READ-ONLY production readiness probe. No DDL/DML.
-- Run manually with read-only SQL access; the latest date is intraday.
WITH days AS (
 SELECT generate_series(
   (now() AT TIME ZONE 'Asia/Tokyo')::date - 4,
   (now() AT TIME ZONE 'Asia/Tokyo')::date,
   interval '1 day'
 )::date AS race_date
), persisted AS (
 SELECT d.race_date,
   (SELECT count(*) FROM public.bs_race_events e WHERE e.race_date=d.race_date) AS events,
   (SELECT count(*) FROM public.bs_race_entries en WHERE en.race_date=d.race_date) AS entries,
   (SELECT count(*) FROM public.bs_race_results r WHERE r.race_date=d.race_date) AS results,
   (SELECT count(*) FROM (
     SELECT en.course_code,en.race_no
     FROM public.bs_race_entries en WHERE en.race_date=d.race_date
     GROUP BY en.course_code,en.race_no HAVING count(*)<>6
   ) bad) AS incomplete_six_boat_races
 FROM days d
), sync AS (
 SELECT race_date,
   count(*) FILTER(WHERE status='success') AS successful_calls,
   max(event_rows) FILTER(WHERE status='success') AS max_reported_events,
   max(entry_rows) FILTER(WHERE status='success') AS max_reported_entries
 FROM public.bs_live_source_sync_logs
 WHERE race_date BETWEEN (now() AT TIME ZONE 'Asia/Tokyo')::date-4
   AND (now() AT TIME ZONE 'Asia/Tokyo')::date
   AND sync_kind='live_all'
 GROUP BY race_date
)
SELECT p.race_date,p.events,p.entries,p.results,
 p.incomplete_six_boat_races,
 coalesce(s.successful_calls,0) AS successful_calls,
 s.max_reported_events,s.max_reported_entries,
 CASE
  WHEN p.results>0 AND p.events=0 THEN 'HOLD: results exist without events'
  WHEN p.events>0 AND p.entries<>6*p.events THEN 'HOLD: event/entry count mismatch'
  WHEN p.incomplete_six_boat_races>0 THEN 'HOLD: incomplete six-boat entries'
  WHEN p.events=0 THEN 'HOLD: no persisted events (not proof of a valid empty schedule)'
  ELSE 'COUNT-ONLY PASS: validate racer identity and source payload separately'
 END AS readiness
FROM persisted p LEFT JOIN sync s USING(race_date)
ORDER BY p.race_date;
