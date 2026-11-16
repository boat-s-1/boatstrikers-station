-- PR #298: read-only production bootstrap readiness and alert fan-out estimate.
-- No DML, DDL, RPC calls, trigger execution, or secrets.
-- Run as a SELECT-only audit; date is current Asia/Tokyo.
WITH target AS (
  SELECT (now() AT TIME ZONE 'Asia/Tokyo')::date AS race_date
), entry_summary AS (
  SELECT e.race_date, e.course_code, e.race_no,
         count(*) AS boats,
         count(*) FILTER (
           WHERE coalesce(e.official_exhibition_time, e.exhibition_time) IS NOT NULL
             AND coalesce(e.official_lap, e.lap_time) IS NOT NULL
         ) AS complete_exhibition_lap_pairs,
         count(*) FILTER (WHERE e.data_source='BOATRACE_OPEN_API_BOOTSTRAP') AS bootstrap_boats
  FROM public.bs_race_entries e
  JOIN target t ON t.race_date=e.race_date
  GROUP BY e.race_date,e.course_code,e.race_no
), totals AS (
  SELECT count(*) AS race_groups,
         coalesce(sum(boats),0) AS entry_rows,
         coalesce(sum(bootstrap_boats),0) AS bootstrap_entry_rows,
         count(*) FILTER (WHERE boats=6 AND complete_exhibition_lap_pairs=6) AS ready_races
  FROM entry_summary
)
SELECT t.race_date,
       (SELECT count(*) FROM public.bs_race_events ev WHERE ev.race_date=t.race_date) AS event_rows,
       totals.race_groups,
       totals.entry_rows,
       totals.bootstrap_entry_rows,
       totals.ready_races,
       (SELECT count(*) FROM public.bs_ichika_escape_surge_alerts a WHERE a.race_date=t.race_date) AS alert_rows,
       'Per-row INSERT trigger may invoke full-day alert evaluation; row counts are not notification counts' AS interpretation
FROM target t CROSS JOIN totals;
