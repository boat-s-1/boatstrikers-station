-- ISOLATED DB ONLY. Requires both completeness-v3 candidate functions.
-- This is a distinct recorder: it does NOT replace the production v2 recorder.
-- WARNING: invokes INSERT/UPDATE and pg_notify. Never execute on production without approval.
CREATE OR REPLACE FUNCTION public.bs_record_race_data_completeness_v3_candidate(p_date date)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public'
AS $fn$
DECLARE
 v_detail jsonb;
 v_status text;
 v_active integer := 0;
 v_resolved integer := 0;
BEGIN
 IF p_date IS NULL OR p_date > (now() AT TIME ZONE 'Asia/Tokyo')::date
    OR p_date < DATE '2024-01-01' THEN
   RAISE EXCEPTION 'invalid completeness date';
 END IF;

 v_detail := public.bs_race_data_completeness_v3_candidate(p_date);
 -- Fail closed on empty source data. An empty day is not proof that prior
 -- missing races were repaired; never resolve alerts by vacuous NOT EXISTS.
 IF coalesce((v_detail->>'races')::bigint,0)=0 THEN
   RAISE EXCEPTION 'V3 quality has no race keys for %, refusing alert mutation',p_date;
 END IF;
 -- A previously alerted race disappearing from BOTH source anchors is not a
 -- recovery. Require manual reconciliation instead of silently resolving it.
 IF EXISTS (
   SELECT 1 FROM public.bs_race_data_quality_alerts a
   WHERE a.race_date=p_date AND a.status='active'
     AND NOT EXISTS (
       SELECT 1 FROM public.bs_race_data_quality_rows_v3_candidate(p_date) q
       WHERE q.course_code=a.course_code AND q.race_no=a.race_no
     )
 ) THEN
   RAISE EXCEPTION 'V3 source race key disappeared for %, refusing alert resolution',p_date;
 END IF;
 -- V3 currently anchors events and results, not entry-only keys. If such
 -- a key exists, refuse any alert mutation until coverage is extended.
 IF EXISTS (
   SELECT 1 FROM public.bs_race_entries en
   WHERE en.race_date=p_date
     AND NOT EXISTS (
       SELECT 1 FROM public.bs_race_events ev
       WHERE ev.race_date=en.race_date AND ev.course_code=en.course_code
         AND ev.race_no=en.race_no
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.bs_race_results r
       WHERE r.race_date=en.race_date AND r.course_code=en.course_code
         AND r.race_no=en.race_no
     )
 ) THEN
   RAISE EXCEPTION 'V3 uncovered entry-only race key for %, refusing alert mutation',p_date;
 END IF;
 v_status := CASE WHEN coalesce((v_detail->>'is_complete')::boolean,false)
                  THEN 'success' ELSE 'partial' END;

 INSERT INTO public.bs_race_data_quality_alerts (
   race_date,course_code,course_name,race_no,severity,status,
   missing_fields,detail,first_detected_at,last_detected_at,resolved_at,updated_at
 )
 SELECT q.race_date,q.course_code,q.course_name,q.race_no,
        CASE WHEN 'base_event'=ANY(q.missing_fields)
               OR 'entries'=ANY(q.missing_fields)
               OR 'result'=ANY(q.missing_fields)
             THEN 'critical' ELSE 'warning' END,
        'active',q.missing_fields,
        jsonb_build_object('entry_rows',q.entry_rows,
                           'exhibition_rows',q.exhibition_rows,
                           'start_rows',q.start_rows,
                           'has_result',q.has_result,'has_payout',q.has_payout,
                           'checked_at',now()),
        now(),now(),NULL,now()
 FROM public.bs_race_data_quality_rows_v3_candidate(p_date) q
 WHERE NOT q.is_complete
 ON CONFLICT (race_date,course_code,race_no) DO UPDATE SET
   course_name=excluded.course_name,
   severity=excluded.severity,
   status='active',
   missing_fields=excluded.missing_fields,
   detail=excluded.detail,
   last_detected_at=now(),
   resolved_at=NULL,
   updated_at=now();
 GET DIAGNOSTICS v_active = ROW_COUNT;

 -- Critical: resolution MUST use the same unified v3 issue set.
 UPDATE public.bs_race_data_quality_alerts a
 SET status='resolved',resolved_at=now(),updated_at=now()
 WHERE a.race_date=p_date AND a.status='active'
   AND NOT EXISTS (
     SELECT 1 FROM public.bs_race_data_quality_rows_v3_candidate(p_date) q
     WHERE q.course_code=a.course_code AND q.race_no=a.race_no
       AND NOT q.is_complete
   );
 GET DIAGNOSTICS v_resolved = ROW_COUNT;

 INSERT INTO public.bs_live_source_sync_logs(
   source,sync_kind,race_date,status,
   entry_rows,event_rows,result_rows,result_entry_rows,
   started_at,finished_at,detail
 ) VALUES (
   'boatstrikers/completeness-v3-candidate','daily_completeness_v3_candidate',
   p_date,v_status,
   (v_detail->>'entries_complete')::integer,
   (v_detail->>'races')::integer,
   (v_detail->>'results_complete')::integer,
   (v_detail->>'result_details_complete')::integer,
   now(),now(),
   v_detail || jsonb_build_object(
     'active_alerts_written',v_active,'alerts_resolved',v_resolved,
     'notification_target','admin_alert_center'
   )
 );

 IF v_status='partial' THEN
   PERFORM pg_notify('boatstrikers_data_quality_alert',
     jsonb_build_object(
       'race_date',p_date,'issue_count',(v_detail->>'issue_count')::integer,
       'checked_at',now()
     )::text);
 END IF;

 RETURN v_detail || jsonb_build_object(
   'active_alerts_written',v_active,'alerts_resolved',v_resolved);
END
$fn$;
REVOKE ALL ON FUNCTION public.bs_record_race_data_completeness_v3_candidate(date)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bs_record_race_data_completeness_v3_candidate(date) TO service_role;
-- Isolated integration must test no duplicate alert rows on replay,
-- first_detected_at preservation, correct resolution, and notifications.
-- Note: v2 recorder must not run concurrently on the same date during candidate tests:
-- it would resolve result-only alerts using its narrower v2 issue set.
