-- PR298: READ-ONLY readiness probe. Never mutate production.
-- A persisted-count PASS does not establish authoritative schedule coverage.
WITH days AS (
 SELECT generate_series(
  (now() AT TIME ZONE 'Asia/Tokyo')::date - 4,
  (now() AT TIME ZONE 'Asia/Tokyo')::date,
  interval '1 day')::date AS race_date
), persisted AS (
 SELECT d.race_date,
  (SELECT count(*) FROM public.bs_race_events e WHERE e.race_date=d.race_date) AS events,
  (SELECT count(*) FROM public.bs_race_entries en WHERE en.race_date=d.race_date) AS entries,
  (SELECT count(*) FROM public.bs_race_results r WHERE r.race_date=d.race_date) AS results,
  (SELECT count(*) FROM public.bs_race_results r
    WHERE r.race_date=d.race_date AND NOT EXISTS (
     SELECT 1 FROM public.bs_race_events e WHERE e.race_date=r.race_date
       AND e.course_code=r.course_code AND e.race_no=r.race_no
    )) AS orphan_result_races,
  (SELECT count(*) FROM public.bs_race_events e
    WHERE e.race_date=d.race_date AND
     (SELECT count(*) FROM public.bs_race_entries en
      WHERE en.race_date=e.race_date AND en.course_code=e.course_code
       AND en.race_no=e.race_no)<>6) AS events_without_six_entries,
  (SELECT count(*) FROM (
   SELECT en.course_code,en.race_no FROM public.bs_race_entries en
   WHERE en.race_date=d.race_date
   GROUP BY en.course_code,en.race_no
   HAVING count(*)<>6 OR count(DISTINCT en.boat_no)<>6
    OR count(DISTINCT en.racer_registration_no)<>6
    OR count(*) FILTER (WHERE en.boat_no NOT BETWEEN 1 AND 6
      OR en.racer_registration_no IS NULL
      OR en.racer_registration_no IN ('0000','00000')
      OR length(en.racer_registration_no) NOT IN (4,5))>0
  ) bad) AS invalid_entry_races
 FROM days d
), sync AS (
 SELECT race_date,
  count(*) FILTER (WHERE status='success') AS successful_calls,
  max(event_rows) FILTER (WHERE status='success') AS max_reported_events,
  max(entry_rows) FILTER (WHERE status='success') AS max_reported_entries
 FROM public.bs_live_source_sync_logs
 WHERE race_date BETWEEN (now() AT TIME ZONE 'Asia/Tokyo')::date-4
   AND (now() AT TIME ZONE 'Asia/Tokyo')::date
   AND sync_kind='live_all'
 GROUP BY race_date
)
SELECT p.race_date,p.events,p.entries,p.results,
 p.orphan_result_races,p.events_without_six_entries,p.invalid_entry_races,
 coalesce(s.successful_calls,0) AS successful_calls,
 s.max_reported_events,s.max_reported_entries,
 CASE
  WHEN p.orphan_result_races>0 THEN 'HOLD: orphan result keys'
  WHEN p.events_without_six_entries>0 THEN 'HOLD: event missing six entries'
  WHEN p.invalid_entry_races>0 THEN 'HOLD: invalid per-race boat identities'
  WHEN p.events>0 AND p.entries<>6*p.events THEN 'HOLD: aggregate count mismatch'
  WHEN p.events=0 THEN 'HOLD: no persisted events'
  ELSE 'LOCAL-IDENTITY PASS ONLY: verify official schedule separately'
 END AS readiness
FROM persisted p LEFT JOIN sync s USING(race_date)
ORDER BY p.race_date;
