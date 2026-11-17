-- PR298 READ ONLY. Produce exact eligible historical result-only race keys.
-- This inventory is an audit, NOT authorization to run the writer.
-- Recheck immediately before any future approved repair.
WITH result_only AS (
 SELECT r.race_date,r.course_code,r.race_no
 FROM public.bs_race_results r
 WHERE r.race_date BETWEEN DATE '2026-11-13' AND DATE '2026-11-17'
 AND NOT EXISTS (
  SELECT 1 FROM public.bs_race_events e
  WHERE (e.race_date,e.course_code,e.race_no)=
        (r.race_date,r.course_code,r.race_no))
)
SELECT race_date,course_code,count(*) AS missing_races,
 min(race_no) AS first_race_no,max(race_no) AS last_race_no,
 string_agg(race_no::text,',' ORDER BY race_no) AS missing_race_numbers
FROM result_only
GROUP BY race_date,course_code ORDER BY race_date,course_code;

-- Fail-closed diagnostic for duplicate result keys (should be zero).
SELECT race_date,course_code,race_no,count(*) AS duplicate_count
FROM public.bs_race_results
WHERE race_date BETWEEN DATE '2026-11-13' AND DATE '2026-11-17'
GROUP BY race_date,course_code,race_no HAVING count(*)>1;
