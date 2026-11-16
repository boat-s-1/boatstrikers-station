-- CANDIDATE ONLY: install on an isolated database, never directly on production.
-- SECURITY INVOKER avoids introducing a new privileged public RPC.
-- Restrict default PUBLIC execution within the same deployment transaction.
-- The existing quality function is kept intact; this function extends it with result-only keys.
CREATE OR REPLACE FUNCTION public.bs_race_data_quality_rows_v3_candidate(p_date date)
RETURNS TABLE (
 race_date date, course_code smallint, course_name text, race_no smallint,
 is_cancelled boolean, entry_rows bigint, exhibition_rows bigint, start_rows bigint,
 has_result boolean, has_payout boolean, missing_fields text[], is_complete boolean
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $fn$
 WITH existing AS (
   SELECT * FROM public.bs_race_data_quality_rows(p_date)
 ), result_only AS (
   SELECT r.race_date, r.course_code, NULL::text AS course_name, r.race_no,
          false AS is_cancelled,
          count(en.id)::bigint AS entry_rows,
          count(en.id) FILTER (
            WHERE coalesce(en.official_exhibition_time,en.exhibition_time) IS NOT NULL
          )::bigint AS exhibition_rows,
          count(en.id) FILTER (
            WHERE coalesce(en.actual_start_timing,en.actual_st) IS NOT NULL
          )::bigint AS start_rows,
          true AS has_result,
          bool_or(r.trifecta_payout IS NOT NULL
            AND coalesce(r.trifecta_result,r.winning_trifecta) IS NOT NULL) AS has_payout
   FROM public.bs_race_results r
   LEFT JOIN public.bs_race_entries en USING(race_date,course_code,race_no)
   WHERE r.race_date=p_date
     AND NOT EXISTS (
       SELECT 1 FROM public.bs_race_events ev
       WHERE ev.race_date=r.race_date AND ev.course_code=r.course_code
         AND ev.race_no=r.race_no
     )
   GROUP BY r.race_date,r.course_code,r.race_no
 )
 SELECT * FROM existing
 UNION ALL
 SELECT x.race_date,x.course_code,x.course_name,x.race_no,
        x.is_cancelled,x.entry_rows,x.exhibition_rows,x.start_rows,
        x.has_result,x.has_payout,
        array_remove(ARRAY[
          'base_event'::text,
          CASE WHEN x.entry_rows<>6 THEN 'entries' END,
          CASE WHEN x.exhibition_rows<>6 THEN 'exhibition' END,
          CASE WHEN NOT x.has_payout THEN 'payout' END,
          CASE WHEN x.start_rows<>6 THEN 'result_detail' END
        ],NULL)::text[] AS missing_fields,
        false AS is_complete
 FROM result_only x
$fn$;

REVOKE ALL ON FUNCTION public.bs_race_data_quality_rows_v3_candidate(date) FROM PUBLIC, anon, authenticated;

-- After isolated tests: implement completeness summary AND recorder against this unified
-- function in the same release. In particular, recorder's resolution NOT EXISTS
-- must use this unified function; otherwise result-only alerts resolve prematurely.
