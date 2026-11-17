-- REVIEW ONLY. NEVER EXECUTE WITHOUT SEPARATE PRODUCTION CUTOVER APPROVAL.
-- Requires V3 candidate functions installed and fully verified on production
-- under a separately approved migration. Keeps the existing cron schedule/job ID.
-- Production snapshot: jobname boatstrikers-data-completeness-0110-jst, jobid 24,
-- schedule 10 16 * * * (01:10 JST).
BEGIN;
DO $gate$
DECLARE v_job_id bigint; v_schedule text; v_command text; v_active boolean; v_username text;
BEGIN
 SELECT jobid,schedule,command,active,username
 INTO STRICT v_job_id,v_schedule,v_command,v_active,v_username
 FROM cron.job WHERE jobname='boatstrikers-data-completeness-0110-jst';
 IF v_job_id<>24 OR v_username<>'postgres' OR v_schedule<>'10 16 * * *' OR NOT v_active
   OR btrim(v_command)<>'select public.bs_record_race_data_completeness(((now() at time zone ''Asia/Tokyo'')::date - 1));' THEN
   RAISE EXCEPTION 'V2 cron drift detected; abort cutover';
 END IF;
 IF to_regprocedure('public.bs_record_race_data_completeness_v3_candidate(date)') IS NULL
    OR to_regprocedure('public.bs_race_data_completeness_v3_candidate(date)') IS NULL
    OR to_regprocedure('public.bs_race_data_quality_rows_v3_candidate(date)') IS NULL THEN
   RAISE EXCEPTION 'V3 function chain not installed; abort cutover';
 END IF;
 IF NOT has_function_privilege('postgres',
       'public.bs_record_race_data_completeness_v3_candidate(date)', 'EXECUTE')
    OR NOT has_function_privilege('postgres',
       'public.bs_race_data_completeness_v3_candidate(date)', 'EXECUTE')
    OR NOT has_function_privilege('postgres',
       'public.bs_race_data_quality_rows_v3_candidate(date)', 'EXECUTE') THEN
   RAISE EXCEPTION 'Cron execution role lacks V3 function permissions';
 END IF;
 PERFORM cron.alter_job(job_id=>v_job_id,
   command=>'select public.bs_record_race_data_completeness_v3_candidate(((now() at time zone ''Asia/Tokyo'')::date - 1));');
END $gate$;
COMMIT;
-- Post-cutover: inspect cron.job, validate one daily run, compare V3 summary
-- to independently observed race keys, then authorize release separately.
