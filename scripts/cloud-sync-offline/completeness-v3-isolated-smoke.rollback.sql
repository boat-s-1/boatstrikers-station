-- ISOLATED DATABASE ONLY. DO NOT RUN ON PRODUCTION.
-- Requires all three V3 candidate functions installed and historical 2026-11-13
-- result-only fixture rows seeded. No V2 recorder should run concurrently.
-- All alert/log changes and pg_notify are rolled back at end.
BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';

DO $test$
DECLARE
 v_date date := DATE '2026-11-13';
 v_expected bigint;
 v_first jsonb;
 v_second jsonb;
 v_alerts bigint;
 v_unique bigint;
 v_first_seen_before timestamptz;
 v_first_seen_after timestamptz;
BEGIN
 SELECT count(*) INTO v_expected
 FROM public.bs_race_results r
 WHERE r.race_date=v_date
   AND NOT EXISTS (
     SELECT 1 FROM public.bs_race_events e
     WHERE e.race_date=r.race_date AND e.course_code=r.course_code
       AND e.race_no=r.race_no
   );
 IF v_expected=0 THEN
   RAISE EXCEPTION 'missing seeded result-only fixture data for %',v_date;
 END IF;

 v_first := public.bs_record_race_data_completeness_v3_candidate(v_date);
 IF (v_first->>'missing_base_event_count')::bigint<>v_expected THEN
   RAISE EXCEPTION 'v3 missing base count mismatch: expected %, got %',
      v_expected,v_first->>'missing_base_event_count';
 END IF;
 SELECT count(*),count(DISTINCT (course_code,race_no)),min(first_detected_at)
 INTO v_alerts,v_unique,v_first_seen_before
 FROM public.bs_race_data_quality_alerts
 WHERE race_date=v_date AND status='active'
   AND 'base_event'=ANY(missing_fields);
 IF v_alerts<>v_expected OR v_unique<>v_expected THEN
   RAISE EXCEPTION 'v3 alert count/unique mismatch: % / %, expected %',
     v_alerts,v_unique,v_expected;
 END IF;

 v_second := public.bs_record_race_data_completeness_v3_candidate(v_date);
 SELECT min(first_detected_at) INTO v_first_seen_after
 FROM public.bs_race_data_quality_alerts
 WHERE race_date=v_date AND status='active'
   AND 'base_event'=ANY(missing_fields);
 IF v_first_seen_before IS DISTINCT FROM v_first_seen_after THEN
   RAISE EXCEPTION 'first_detected_at changed on retry';
 END IF;
 IF (v_second->>'missing_base_event_count')::bigint<>v_expected THEN
   RAISE EXCEPTION 'second run changed issue count';
 END IF;
 RAISE NOTICE 'PASS: % result-only alerts, stable first_detected_at, replay',v_expected;
END
$test$;

-- No committed writes and no delivered pg_notify from this transaction.
ROLLBACK;
