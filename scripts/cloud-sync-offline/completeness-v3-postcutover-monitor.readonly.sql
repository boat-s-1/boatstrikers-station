-- PR #298 — READ ONLY, may run before/after cutover.
-- Does not call any recorder; does not send notifications or alter Cron.
WITH job AS (
 SELECT jobid,jobname,schedule,active,command
 FROM cron.job WHERE jobname='boatstrikers-data-completeness-0110-jst'
), recent_runs AS (
 SELECT d.jobid,d.status,d.start_time,d.end_time
 FROM cron.job_run_details d
 JOIN job j ON j.jobid=d.jobid
 ORDER BY d.start_time DESC LIMIT 8
), last_runs AS (
 SELECT count(*)::integer AS run_count,
        count(*) FILTER(WHERE status='succeeded')::integer AS succeeded,
        max(start_time) AS latest_start
 FROM recent_runs
), source_keys AS (
 SELECT r.race_date,r.course_code,r.race_no
 FROM public.bs_race_results r
 WHERE r.race_date BETWEEN ((now() AT TIME ZONE 'Asia/Tokyo')::date - 7)
                       AND ((now() AT TIME ZONE 'Asia/Tokyo')::date - 1)
 AND NOT EXISTS (
   SELECT 1 FROM public.bs_race_events e
   WHERE e.race_date=r.race_date AND e.course_code=r.course_code
     AND e.race_no=r.race_no
 )
), source_summary AS (
 SELECT count(*)::integer AS result_only_keys FROM source_keys
), alert_summary AS (
 SELECT count(*) FILTER(WHERE a.status='active' AND 'base_event'=ANY(a.missing_fields))::integer AS active_base_event_alerts,
        count(*) FILTER(WHERE a.status='resolved' AND 'base_event'=ANY(a.missing_fields))::integer AS resolved_base_event_alerts
 FROM public.bs_race_data_quality_alerts a
 WHERE a.race_date BETWEEN ((now() AT TIME ZONE 'Asia/Tokyo')::date - 7)
                       AND ((now() AT TIME ZONE 'Asia/Tokyo')::date - 1)
)
SELECT j.jobid,j.jobname,j.schedule,j.active,
 CASE WHEN j.command LIKE '%bs_record_race_data_completeness_v3_candidate%' THEN 'v3_candidate'
      WHEN j.command LIKE '%bs_record_race_data_completeness(%' THEN 'v2'
      ELSE 'unexpected' END AS recorder,
 lr.run_count,lr.succeeded,lr.latest_start,
 ss.result_only_keys,al.active_base_event_alerts,al.resolved_base_event_alerts,
 (ss.result_only_keys>al.active_base_event_alerts) AS review_alert_coverage
FROM job j CROSS JOIN last_runs lr CROSS JOIN source_summary ss CROSS JOIN alert_summary al;
-- IMPORTANT: Coverage is NOT a strict equality invariant. Alerts may cover a
-- different day or be resolved for legitimate reasons. Investigate discrepancies.
