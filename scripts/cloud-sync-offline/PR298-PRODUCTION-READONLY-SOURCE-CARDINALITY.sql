-- PR #298: read-only source-reported vs persisted daily count audit.
-- The existing live_all success logs can report incomplete six-boat input.
-- This is an aggregate anomaly detector, NOT a proof of per-race identity.
WITH days AS (
 SELECT generate_series(
  (now() AT TIME ZONE 'Asia/Tokyo')::date-6,
  (now() AT TIME ZONE 'Asia/Tokyo')::date, interval '1 day'
 )::date AS race_date
), source AS (
 SELECT race_date,
  count(*) FILTER (WHERE status='success') AS success_calls,
  max(event_rows) FILTER (WHERE status='success') AS max_reported_events,
  max(entry_rows) FILTER (WHERE status='success') AS max_reported_entries,
  count(*) FILTER (WHERE status='success' AND event_rows>0
    AND entry_rows IS DISTINCT FROM 6*event_rows) AS successful_calls_with_non_six_boat_counts
 FROM public.bs_live_source_sync_logs
 WHERE sync_kind='live_all'
  AND race_date BETWEEN (now() AT TIME ZONE 'Asia/Tokyo')::date-6
   AND (now() AT TIME ZONE 'Asia/Tokyo')::date
 GROUP BY race_date
), persisted AS (
 SELECT d.race_date,
  (SELECT count(*) FROM public.bs_race_events e WHERE e.race_date=d.race_date) AS events,
  (SELECT count(*) FROM public.bs_race_entries e WHERE e.race_date=d.race_date) AS entries
 FROM days d
)
SELECT p.race_date,coalesce(s.success_calls,0) AS success_calls,
 s.max_reported_events,s.max_reported_entries,
 CASE WHEN s.max_reported_events>0 THEN
   6*s.max_reported_events-s.max_reported_entries END AS max_count_delta,
 coalesce(s.successful_calls_with_non_six_boat_counts,0) AS success_logs_with_count_mismatch,
 p.events AS persisted_events,p.entries AS persisted_entries,
 CASE WHEN p.events=0 OR p.entries=0 THEN 'HOLD: no persisted program'
 WHEN p.entries<>6*p.events THEN 'HOLD: persisted six-boat mismatch'
 WHEN coalesce(s.successful_calls_with_non_six_boat_counts,0)>0 THEN
  'HOLD: successful source logs with incomplete count'
 ELSE 'COUNT-ONLY PASS: still check race and racer IDs' END AS gate
FROM persisted p LEFT JOIN source s USING(race_date)
ORDER BY p.race_date;
