-- ISOLATED DATABASE ONLY. Requires completeness-v3-unified-quality-rows.candidate.sql.
-- No replacement of the production v2 summary. Read-only SECURITY INVOKER candidate.
CREATE OR REPLACE FUNCTION public.bs_race_data_completeness_v3_candidate(p_date date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $fn$
WITH quality AS (
 SELECT * FROM public.bs_race_data_quality_rows_v3_candidate(p_date)
), summary AS (
 SELECT count(*) AS races,
        count(*) FILTER (WHERE is_cancelled OR entry_rows=6) AS entries_complete,
        count(*) FILTER (WHERE is_cancelled OR exhibition_rows=6) AS exhibition_complete,
        count(*) FILTER (WHERE is_cancelled OR (has_result AND has_payout)) AS results_complete,
        count(*) FILTER (WHERE is_cancelled OR (has_result AND start_rows=6)) AS result_details_complete,
        count(*) FILTER (WHERE NOT is_complete) AS issue_count,
        count(*) FILTER (WHERE 'base_event'=ANY(missing_fields)) AS missing_base_event_count,
        coalesce(jsonb_agg(jsonb_build_object(
          'race_date',race_date,'course_code',course_code,'course_name',course_name,
          'race_no',race_no,'missing_fields',missing_fields,'entry_rows',entry_rows,
          'exhibition_rows',exhibition_rows,'start_rows',start_rows,
          'has_result',has_result,'has_payout',has_payout
        ) ORDER BY course_code,race_no) FILTER (WHERE NOT is_complete),'[]'::jsonb) AS issues
 FROM quality
)
SELECT jsonb_build_object(
 'race_date',p_date,'races',races,'entries_complete',entries_complete,
 'exhibition_complete',exhibition_complete,'results_complete',results_complete,
 'result_details_complete',result_details_complete,
 'issue_count',issue_count,'missing_base_event_count',missing_base_event_count,
 'issues',issues,'is_complete',(races>0 AND issue_count=0),'checked_at',now()
) FROM summary
$fn$;
REVOKE ALL ON FUNCTION public.bs_race_data_completeness_v3_candidate(date) FROM PUBLIC, anon, authenticated;
-- Grant to the dedicated test role only when executing isolated integration tests.
