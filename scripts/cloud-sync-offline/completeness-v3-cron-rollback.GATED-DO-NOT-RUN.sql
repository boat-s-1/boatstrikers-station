-- REVIEW ONLY. NEVER EXECUTE WITHOUT PRODUCTION ROLLBACK AUTHORIZATION.
-- Restores original V2 command only when the expected V3 candidate is present.
BEGIN;
DO $gate$
DECLARE v_job_id bigint; v_schedule text; v_command text; v_active boolean;
BEGIN
 SELECT jobid,schedule,command,active
 INTO STRICT v_job_id,v_schedule,v_command,v_active
 FROM cron.job WHERE jobname='boatstrikers-data-completeness-0110-jst';
 IF v_job_id<>24 OR v_schedule<>'10 16 * * *' OR NOT v_active
   OR btrim(v_command)<>'select public.bs_record_race_data_completeness_v3_candidate(((now() at time zone ''Asia/Tokyo'')::date - 1));' THEN
   RAISE EXCEPTION 'V3 cron drift detected; abort rollback';
 END IF;
 PERFORM cron.alter_job(job_id=>v_job_id,
   command=>'select public.bs_record_race_data_completeness(((now() at time zone ''Asia/Tokyo'')::date - 1));');
END $gate$;
COMMIT;
-- IMPORTANT: V2 recorder will not recognize result-only alerts and may resolve
-- them on its next run. Before rollback, explicitly plan alert reconciliation;
-- do not silently interpret resolved alerts as recovered source data.
