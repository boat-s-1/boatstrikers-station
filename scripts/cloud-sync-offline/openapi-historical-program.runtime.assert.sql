-- Disposable PostgreSQL CI only: execute historical candidate against
-- synthetic result-only race; no production write or external data.
DO $test$
DECLARE
 d date:=DATE '2026-11-15'; ev jsonb; en jsonb; response jsonb;
 before_result jsonb; after_result jsonb; failure boolean;
BEGIN
 INSERT INTO public.bs_race_results
  (race_date,course_code,race_no,trifecta_result,trifecta_payout,result_status,synced_at)
 VALUES(d,10,10,'2-1-4',9450,'settled',now());
 SELECT to_jsonb(r) INTO before_result FROM public.bs_race_results r
 WHERE (race_date,course_code,race_no)=(d,10,10);
 ev:=jsonb_build_array(jsonb_build_object('race_date',d,'course_code',10,'race_no',10));
 SELECT jsonb_agg(jsonb_build_object('race_date',d,'course_code',10,
   'race_no',10,'boat_no',b,'racer_registration_no',lpad((4000+b)::text,5,'0')))
 INTO en FROM generate_series(1,6) b;
 response:=public.bs_apply_openapi_historical_program_candidate(d,ev,en,now());
 IF (response->>'event_count')::int<>1 OR (response->>'entry_count')::int<>6 THEN
   RAISE EXCEPTION 'historical candidate successful write counts unexpected: %',response;
 END IF;
 SELECT to_jsonb(r) INTO after_result FROM public.bs_race_results r
 WHERE (race_date,course_code,race_no)=(d,10,10);
 IF before_result IS DISTINCT FROM after_result THEN
   RAISE EXCEPTION 'historical candidate altered settled result or payout';
 END IF;
 response:=public.bs_apply_openapi_historical_program_candidate(d,ev,en,now());
 IF (response->'bootstrap'->>'event_inserted')::int<>0 OR
    (response->'bootstrap'->>'entry_inserted')::int<>0 THEN
   RAISE EXCEPTION 'historical candidate replay not idempotent: %',response;
 END IF;
 -- Five-boat source must be rejected before the legacy writer can act.
 failure:=false;
 BEGIN
  PERFORM public.bs_apply_openapi_historical_program_candidate(
    DATE '2026-11-16',
    jsonb_build_array(jsonb_build_object('race_date','2026-11-16','course_code',10,'race_no',11)),
    (SELECT jsonb_agg(jsonb_build_object('race_date','2026-11-16','course_code',10,
      'race_no',11,'boat_no',b,'racer_registration_no',lpad((5000+b)::text,5,'0')))
      FROM generate_series(1,5) b),now());
 EXCEPTION WHEN OTHERS THEN failure:=true;
 END;
 IF NOT failure OR EXISTS (SELECT 1 FROM public.bs_race_events
   WHERE race_date=DATE '2026-11-16' AND course_code=10 AND race_no=11) THEN
   RAISE EXCEPTION 'historical candidate accepted incomplete five-boat program';
 END IF;
 -- Duplicate racer registration must reject entire race.
 failure:=false;
 BEGIN
  PERFORM public.bs_apply_openapi_historical_program_candidate(
    DATE '2026-11-14',
    jsonb_build_array(jsonb_build_object('race_date','2026-11-14','course_code',10,'race_no',12)),
    (SELECT jsonb_agg(jsonb_build_object('race_date','2026-11-14','course_code',10,
      'race_no',12,'boat_no',b,'racer_registration_no',
      CASE WHEN b=6 THEN '06001' ELSE lpad((6000+b)::text,5,'0') END))
      FROM generate_series(1,6) b),now());
 EXCEPTION WHEN OTHERS THEN failure:=true;
 END;
 IF NOT failure OR EXISTS (SELECT 1 FROM public.bs_race_events
   WHERE race_date=DATE '2026-11-14' AND course_code=10 AND race_no=12) THEN
   RAISE EXCEPTION 'historical candidate accepted duplicate racer';
 END IF;
 -- An otherwise valid six-boat race without an existing result must fail closed.
 failure:=false;
 BEGIN
  PERFORM public.bs_apply_openapi_historical_program_candidate(
   DATE '2026-11-13',
   jsonb_build_array(jsonb_build_object('race_date','2026-11-13','course_code',12,'race_no',8)),
   (SELECT jsonb_agg(jsonb_build_object('race_date','2026-11-13','course_code',12,
     'race_no',8,'boat_no',b,'racer_registration_no',lpad((8000+b)::text,5,'0')))
    FROM generate_series(1,6) b),now());
 EXCEPTION WHEN OTHERS THEN failure:=true;
 END;
 IF NOT failure OR EXISTS (SELECT 1 FROM public.bs_race_events
   WHERE race_date=DATE '2026-11-13' AND course_code=12 AND race_no=8) THEN
  RAISE EXCEPTION 'historical candidate accepted a race without existing result';
 END IF;
 -- An existing but unsettled result must not authorize a program repair.
 INSERT INTO public.bs_race_results
  (race_date,course_code,race_no,trifecta_result,trifecta_payout,result_status,synced_at)
 VALUES (DATE '2026-11-13',12,7,NULL,NULL,'pending',now());
 failure:=false;
 BEGIN
  PERFORM public.bs_apply_openapi_historical_program_candidate(
   DATE '2026-11-13',
   jsonb_build_array(jsonb_build_object('race_date','2026-11-13','course_code',12,'race_no',7)),
   (SELECT jsonb_agg(jsonb_build_object('race_date','2026-11-13','course_code',12,
     'race_no',7,'boat_no',b,'racer_registration_no',lpad((8100+b)::text,5,'0')))
    FROM generate_series(1,6) b),now());
 EXCEPTION WHEN OTHERS THEN failure:=true;
 END;
 IF NOT failure OR EXISTS (SELECT 1 FROM public.bs_race_events
   WHERE race_date=DATE '2026-11-13' AND course_code=12 AND race_no=7) THEN
  RAISE EXCEPTION 'historical candidate accepted an unsettled result';
 END IF;
 -- A pre-existing extra boat must fail the persisted six-boat assertion and
 -- roll back attempted changes to this race.
 INSERT INTO public.bs_race_results
  (race_date,course_code,race_no,trifecta_result,trifecta_payout,result_status,synced_at)
 VALUES (DATE '2026-11-13',10,9,'1-2-3',1000,'settled',now());
 INSERT INTO public.bs_race_events(id,race_date,course_code,race_no)
 VALUES (991101,DATE '2026-11-13',10,9);
 INSERT INTO public.bs_race_entries(id,race_date,course_code,race_no,boat_no,racer_registration_no)
 VALUES (991102,DATE '2026-11-13',10,9,7,'07007');
 failure:=false;
 BEGIN
  PERFORM public.bs_apply_openapi_historical_program_candidate(
   DATE '2026-11-13',
   jsonb_build_array(jsonb_build_object('race_date','2026-11-13','course_code',10,'race_no',9)),
   (SELECT jsonb_agg(jsonb_build_object('race_date','2026-11-13','course_code',10,
     'race_no',9,'boat_no',b,'racer_registration_no',lpad((7000+b)::text,5,'0')))
    FROM generate_series(1,6) b),now());
 EXCEPTION WHEN OTHERS THEN failure:=true;
 END;
 IF NOT failure OR (SELECT count(*) FROM public.bs_race_entries
   WHERE race_date=DATE '2026-11-13' AND course_code=10 AND race_no=9)<>1 THEN
   RAISE EXCEPTION 'historical candidate failed extra-boat rollback';
 END IF;
 -- Current-day and out-of-scope historical dates must not be accepted.
 failure:=false;
 BEGIN
  PERFORM public.bs_apply_openapi_historical_program_candidate(
    (now() AT TIME ZONE 'Asia/Tokyo')::date,ev,en,now());
 EXCEPTION WHEN OTHERS THEN failure:=true;
 END;
 IF NOT failure THEN RAISE EXCEPTION 'historical candidate accepted current day'; END IF;
 failure:=false;
 BEGIN
  PERFORM public.bs_apply_openapi_historical_program_candidate(
    DATE '2026-11-12',ev,en,now());
 EXCEPTION WHEN OTHERS THEN failure:=true;
 END;
 IF NOT failure THEN RAISE EXCEPTION 'historical candidate accepted out-of-window date'; END IF;
 RAISE NOTICE 'Historical candidate PASS: settled payout preserved, replay, five-boat, duplicate racer, missing/unsettled-result gates, persisted extra-boat rollback, date gates';
END $test$;
