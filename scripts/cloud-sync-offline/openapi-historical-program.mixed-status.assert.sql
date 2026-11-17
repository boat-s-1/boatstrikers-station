-- Disposable PostgreSQL fixture: mixed valid + pending results must not
-- insert any program rows, even for the first valid race.
DO $test$
DECLARE d date:=DATE '2026-11-14'; ev jsonb; en jsonb; failed boolean:=false;
BEGIN
 INSERT INTO public.bs_race_results
  (race_date,course_code,race_no,trifecta_result,trifecta_payout,result_status,synced_at)
 VALUES(d,12,1,'1-2-3',1200,'settled',now()),
       (d,12,2,NULL,NULL,'pending',now());
 ev:=jsonb_build_array(
  jsonb_build_object('race_date',d,'course_code',12,'race_no',1),
  jsonb_build_object('race_date',d,'course_code',12,'race_no',2));
 SELECT jsonb_agg(jsonb_build_object('race_date',d,'course_code',12,
  'race_no',r,'boat_no',b,'racer_registration_no',lpad((9000+r*10+b)::text,5,'0')))
 INTO en FROM generate_series(1,2) r CROSS JOIN generate_series(1,6) b;
 BEGIN
  PERFORM public.bs_apply_openapi_historical_program_candidate(d,ev,en,now());
 EXCEPTION WHEN OTHERS THEN failed:=true;
 END;
 IF NOT failed THEN RAISE EXCEPTION 'mixed pending batch accepted'; END IF;
 IF EXISTS(SELECT 1 FROM public.bs_race_events
  WHERE race_date=d AND course_code=12 AND race_no IN (1,2))
 OR EXISTS(SELECT 1 FROM public.bs_race_entries
  WHERE race_date=d AND course_code=12 AND race_no IN (1,2)) THEN
  RAISE EXCEPTION 'mixed pending batch wrote partial data';
 END IF;
 RAISE NOTICE 'Historical mixed settled/pending batch PASS: no program writes';
END $test$;
