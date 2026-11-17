-- PR298 read-only daily continuity audit. No mutation.
-- Detects the break between healthy historical program ingestion and
-- result-only days. Re-run after any separately approved cloud rollout.
WITH per_race AS (
 SELECT r.race_date,r.course_code,r.race_no,
   EXISTS (SELECT 1 FROM public.bs_race_events ev
     WHERE (ev.race_date,ev.course_code,ev.race_no)=
           (r.race_date,r.course_code,r.race_no)) AS has_event,
   (SELECT count(*) FROM public.bs_race_entries en
     WHERE (en.race_date,en.course_code,en.race_no)=
           (r.race_date,r.course_code,r.race_no)) AS boats
 FROM public.bs_race_results r
 WHERE r.race_date BETWEEN DATE '2026-11-11'
   AND (now() AT TIME ZONE 'Asia/Tokyo')::date
)
SELECT race_date,
 count(*) AS races_with_results,
 count(*) FILTER (WHERE has_event AND boats=6) AS complete_program_races,
 count(*) FILTER (WHERE NOT has_event AND boats=0) AS result_only_races,
 count(*) FILTER (WHERE (has_event AND boats<>6)
    OR (NOT has_event AND boats<>0)) AS partial_program_races,
 CASE WHEN count(*) FILTER (WHERE NOT has_event AND boats=0)>0
   THEN 'HOLD_MISSING_PROGRAM'
   WHEN count(*) FILTER (WHERE (has_event AND boats<>6)
      OR (NOT has_event AND boats<>0))>0 THEN 'HOLD_PARTIAL_PROGRAM'
   ELSE 'RESULT_LINKED_PROGRAM_COMPLETE' END AS diagnostic
FROM per_race GROUP BY race_date ORDER BY race_date;
-- Caution: this query covers races with result rows only. It cannot establish
-- complete official schedules or identify program-only races with no results.
