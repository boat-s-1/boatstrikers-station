-- PR #298: identify daily completeness blind spots without changing data.
-- Distinguish collector "success" from completeness; zero base rows can yield zero issues.
WITH days AS (
  SELECT generate_series(date '2026-11-11', date '2026-11-17', interval '1 day')::date AS race_date
), results AS (
  SELECT race_date, count(*) AS result_count FROM public.bs_race_results
  WHERE race_date BETWEEN '2026-11-11' AND '2026-11-17' GROUP BY race_date
), events AS (
  SELECT race_date, count(*) AS event_count FROM public.bs_race_events
  WHERE race_date BETWEEN '2026-11-11' AND '2026-11-17' GROUP BY race_date
), entries AS (
  SELECT race_date, count(*) AS entry_count FROM public.bs_race_entries
  WHERE race_date BETWEEN '2026-11-11' AND '2026-11-17' GROUP BY race_date
), daily AS (
  SELECT DISTINCT ON (race_date) race_date,status,entry_rows,event_rows,
         coalesce((detail->>'issue_count')::integer,0) AS issue_count,
         coalesce((detail->>'races')::integer,0) AS scanned_races
  FROM public.bs_live_source_sync_logs
  WHERE sync_kind='daily_completeness'
    AND race_date BETWEEN '2026-11-11' AND '2026-11-17'
  ORDER BY race_date,started_at DESC
), live AS (
  SELECT race_date,count(*) AS success_attempts
  FROM public.bs_live_source_sync_logs
  WHERE sync_kind='live_all' AND status='success'
    AND race_date BETWEEN '2026-11-11' AND '2026-11-17'
  GROUP BY race_date
)
SELECT d.race_date,coalesce(r.result_count,0) AS result_count,
       coalesce(e.event_count,0) AS event_count,
       coalesce(b.entry_count,0) AS entry_count,
       coalesce(l.success_attempts,0) AS live_success_attempts,
       a.status AS daily_status,a.scanned_races,a.issue_count,
       CASE
         WHEN coalesce(r.result_count,0)>0 AND coalesce(e.event_count,0)=0
           THEN 'CRITICAL: result rows exist but base events absent'
         WHEN coalesce(e.event_count,0)>0 AND coalesce(b.entry_count,0)<6*e.event_count
           THEN 'WARN: fewer than six entry rows per event'
         WHEN coalesce(e.event_count,0)=0 AND coalesce(r.result_count,0)=0
           THEN 'UNKNOWN: no rows; compare official schedule before declaring complete'
         ELSE 'BASE_ROW_COUNTS_PRESENT'
       END AS audit_verdict
FROM days d LEFT JOIN results r USING(race_date)
LEFT JOIN events e USING(race_date)
LEFT JOIN entries b USING(race_date)
LEFT JOIN daily a USING(race_date)
LEFT JOIN live l USING(race_date)
ORDER BY d.race_date;
