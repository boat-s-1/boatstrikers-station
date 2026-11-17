-- PR #298: production READ ONLY. Historical recovery scope and invariant inventory.
-- Never call bootstrap RPC or any GET/POST route here.
WITH result_only AS (
 SELECT r.race_date,r.course_code,r.race_no
 FROM public.bs_race_results r
 WHERE r.race_date BETWEEN DATE '2026-11-13' AND DATE '2026-11-17'
   AND NOT EXISTS (
    SELECT 1 FROM public.bs_race_events e
    WHERE (e.race_date,e.course_code,e.race_no)=(r.race_date,r.course_code,r.race_no))
), entry_orphans AS (
 SELECT en.race_date,en.course_code,en.race_no,count(*) boat_rows
 FROM public.bs_race_entries en
 WHERE en.race_date BETWEEN DATE '2026-11-13' AND DATE '2026-11-17'
   AND NOT EXISTS (
    SELECT 1 FROM public.bs_race_events e
    WHERE (e.race_date,e.course_code,e.race_no)=(en.race_date,en.course_code,en.race_no))
 GROUP BY en.race_date,en.course_code,en.race_no
)
SELECT r.race_date,
 count(*) AS result_only_races,
 count(*) FILTER (WHERE o.race_date IS NOT NULL) AS result_only_with_orphan_entries,
 coalesce(sum(o.boat_rows),0) AS orphan_boat_rows
FROM result_only r LEFT JOIN entry_orphans o
 ON (o.race_date,o.course_code,o.race_no)=(r.race_date,r.course_code,r.race_no)
GROUP BY r.race_date ORDER BY r.race_date;

-- Production historical repair MUST use a separate vetted source snapshot and
-- separate allowlisted writer; current-day-only atomic RPC rejects these dates.
