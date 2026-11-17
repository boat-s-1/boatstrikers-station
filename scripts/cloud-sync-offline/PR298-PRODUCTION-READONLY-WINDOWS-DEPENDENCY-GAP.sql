-- PR #298: read-only operational gap monitor.
-- Baseline program entries and results are separate sources/tables.
-- Never equate preview log entry_rows to bootstrap program racers.
WITH days AS (
 SELECT generate_series(
   (now() AT TIME ZONE 'Asia/Tokyo')::date - 6,
   (now() AT TIME ZONE 'Asia/Tokyo')::date, interval '1 day'
 )::date AS race_date
), per_day AS (
 SELECT d.race_date,
  (SELECT count(*) FROM public.bs_race_events e WHERE e.race_date=d.race_date) AS program_races,
  (SELECT count(*) FROM public.bs_race_entries e WHERE e.race_date=d.race_date) AS program_boats,
  (SELECT count(*) FROM public.bs_race_results r WHERE r.race_date=d.race_date) AS result_races,
  (SELECT count(*) FROM public.bs_race_results r
    WHERE r.race_date=d.race_date AND r.trifecta_payout IS NOT NULL) AS results_with_trifecta_payout
 FROM days d
)
SELECT *,
 CASE
  WHEN result_races > 0 AND (program_races=0 OR program_boats=0)
    THEN 'HOLD: results without program'
  WHEN program_races>0 AND program_boats <> program_races*6
    THEN 'HOLD: program boat count differs from six per race'
  WHEN program_races>0
    THEN 'COUNT-ONLY PASS: per-race identity and schedule parity still required'
  ELSE 'UNKNOWN: no baseline or results yet'
 END AS status
FROM per_day ORDER BY race_date;
