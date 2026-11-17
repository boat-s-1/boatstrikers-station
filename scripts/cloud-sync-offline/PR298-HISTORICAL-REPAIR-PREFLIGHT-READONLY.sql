-- PR298 read-only production preflight. No function installation or writes.
-- Re-run immediately before any separately approved historical repair.
WITH result_keys AS (
 SELECT r.race_date,r.course_code,r.race_no,r.result_status,
        r.trifecta_result,
        EXISTS(SELECT 1 FROM public.bs_race_events e
          WHERE (e.race_date,e.course_code,e.race_no)=
                (r.race_date,r.course_code,r.race_no)) AS has_event,
        (SELECT count(*) FROM public.bs_race_entries en
          WHERE (en.race_date,en.course_code,en.race_no)=
                (r.race_date,r.course_code,r.race_no)) AS boat_count
 FROM public.bs_race_results r
 WHERE r.race_date BETWEEN DATE '2026-11-13' AND DATE '2026-11-17'
), classified AS (
 SELECT *,
   CASE
    WHEN result_status IS DISTINCT FROM 'confirmed' THEN 'HOLD_NOT_CONFIRMED'
    WHEN trifecta_result IS NULL OR btrim(trifecta_result)='' THEN 'HOLD_NO_TRIFECTA'
    WHEN NOT has_event AND boat_count=0 THEN 'ELIGIBLE_RESULT_ONLY'
    WHEN has_event AND boat_count=6 THEN 'REPLAY_REQUIRES_SOURCE_MATCH'
    ELSE 'HOLD_PARTIAL_OR_CONFLICTING_PROGRAM'
   END AS repair_class
 FROM result_keys
)
SELECT race_date,repair_class,count(*) AS race_count
FROM classified
GROUP BY race_date,repair_class
ORDER BY race_date,repair_class;

-- Exact keys for source-to-result allowlist intersection. Do not treat this
-- inventory as proof of source rights or permission to write.
WITH eligible AS (
 SELECT r.race_date,r.course_code,r.race_no
 FROM public.bs_race_results r
 WHERE r.race_date BETWEEN DATE '2026-11-13' AND DATE '2026-11-17'
   AND r.result_status='confirmed'
   AND r.trifecta_result IS NOT NULL AND btrim(r.trifecta_result)<>''
   AND NOT EXISTS (SELECT 1 FROM public.bs_race_events e
     WHERE (e.race_date,e.course_code,e.race_no)=
       (r.race_date,r.course_code,r.race_no))
   AND NOT EXISTS (SELECT 1 FROM public.bs_race_entries en
     WHERE (en.race_date,en.course_code,en.race_no)=
       (r.race_date,r.course_code,r.race_no))
)
SELECT race_date,course_code,race_no
FROM eligible ORDER BY race_date,course_code,race_no;
