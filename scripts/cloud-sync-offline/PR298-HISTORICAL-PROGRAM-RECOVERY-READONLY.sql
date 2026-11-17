-- PR #298. READ ONLY. Run on production only with read-only privileges.
-- Historical recovery inventory: result rows lacking a matching program.
-- Unlike the current-day-only atomic candidate, these dates cannot be repaired
-- by invoking bs_apply_openapi_atomic_candidate (rejects non-current JST date).
WITH missing AS (
 SELECT r.race_date,r.course_code,r.race_no
 FROM public.bs_race_results r
 LEFT JOIN public.bs_race_events e
  ON (e.race_date,e.course_code,e.race_no)=(r.race_date,r.course_code,r.race_no)
 WHERE r.race_date BETWEEN DATE '2026-11-13' AND DATE '2026-11-17'
   AND e.race_date IS NULL
), per_day AS (
 SELECT race_date,count(*) missing_races,count(DISTINCT course_code) affected_courses
 FROM missing GROUP BY race_date
)
SELECT race_date,missing_races,affected_courses,
 'HOLD: requires separately reviewed historical bootstrap' AS recovery_gate
FROM per_day ORDER BY race_date;

-- A second audit catches races whose event exists but boats are missing,
-- duplicated or not numbered exactly 1 through 6.
WITH per_race AS (
 SELECT e.race_date,e.course_code,e.race_no,
  count(en.boat_no) AS boat_rows,
  count(DISTINCT en.boat_no) AS distinct_boat_numbers,
  count(DISTINCT en.racer_registration_no) AS distinct_racers,
  coalesce(bool_and(en.boat_no BETWEEN 1 AND 6),false) AS valid_boat_range
 FROM public.bs_race_events e
 LEFT JOIN public.bs_race_entries en
 ON (en.race_date,en.course_code,en.race_no)=(e.race_date,e.course_code,e.race_no)
 WHERE e.race_date BETWEEN DATE '2026-11-11' AND DATE '2026-11-17'
 GROUP BY e.race_date,e.course_code,e.race_no
)
SELECT * FROM per_race
WHERE boat_rows<>6 OR distinct_boat_numbers<>6
 OR distinct_racers<>6 OR NOT valid_boat_range
ORDER BY race_date,course_code,race_no;
