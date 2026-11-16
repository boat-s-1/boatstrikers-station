-- PR #298 REVIEW-ONLY proposal. DO NOT APPLY TO PRODUCTION.
-- A read-only diagnostic query that can later be incorporated into completeness-v3.
-- Historical dates with results but no event rows must never silently produce issues=[].
-- This deliberately does NOT create/update functions, alert rows or cron jobs.
WITH result_dates AS (
 SELECT race_date,count(*) AS result_rows
 FROM public.bs_race_results
 WHERE race_date BETWEEN date '2026-11-13' AND date '2026-11-16'
 GROUP BY race_date
), base_events AS (
 SELECT race_date,count(*) AS event_rows
 FROM public.bs_race_events
 WHERE race_date BETWEEN date '2026-11-13' AND date '2026-11-16'
 GROUP BY race_date
), base_entries AS (
 SELECT race_date,count(*) AS entry_rows
 FROM public.bs_race_entries
 WHERE race_date BETWEEN date '2026-11-13' AND date '2026-11-16'
 GROUP BY race_date
)
SELECT r.race_date,r.result_rows,
       coalesce(e.event_rows,0) AS event_rows,
       coalesce(b.entry_rows,0) AS entry_rows,
       CASE
         WHEN coalesce(e.event_rows,0)=0 THEN 'missing_all_base_events'
         WHEN coalesce(b.entry_rows,0)=0 THEN 'missing_all_base_entries'
         WHEN b.entry_rows < e.event_rows*6 THEN 'incomplete_six_boat_entries'
         ELSE 'no_base_count_gap_detected'
       END AS missing_base_code,
       CASE WHEN coalesce(e.event_rows,0)=0 OR coalesce(b.entry_rows,0)<coalesce(e.event_rows,0)*6
         THEN 'critical' ELSE 'none' END AS severity
FROM result_dates r LEFT JOIN base_events e USING (race_date)
LEFT JOIN base_entries b USING (race_date)
ORDER BY r.race_date;
