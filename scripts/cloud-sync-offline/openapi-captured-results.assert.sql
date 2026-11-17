-- Real production results writer, captured unchanged, disposable CI database only.
DO $t$
DECLARE d date:=(now() AT TIME ZONE 'Asia/Tokyo')::date;
 t timestamptz:=now(); v jsonb; n integer;
BEGIN
 PERFORM public.bs_apply_openapi_bootstrap(
   jsonb_build_array(jsonb_build_object('race_date',d,'course_code',9,'race_no',11)),
   (SELECT jsonb_agg(jsonb_build_object('race_date',d,'course_code',9,'race_no',11,
      'boat_no',b,'racer_registration_no',lpad((1000+b)::text,5,'0')))
    FROM generate_series(1,6) b),t);
 v:=public.bs_apply_openapi_results(
   jsonb_build_array(jsonb_build_object('race_date',d,'course_code',9,'race_no',11,
     'winning_method','escape','trifecta_result','1-2-3','trifecta_payout',1230,
     'first_boat',1,'second_boat',2,'third_boat',3)),
   jsonb_build_array(jsonb_build_object('race_date',d,'course_code',9,'race_no',11,
     'boat_no',1,'arrival_order',1,'finish_place','1','actual_course',1,'actual_st',0.12)),t);
 IF (v->>'result_rows')::int<>1 OR (v->>'result_entry_rows')::int<>1
 THEN RAISE EXCEPTION 'results writer counts unexpected %',v; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.bs_race_results
  WHERE race_date=d AND course_code=9 AND race_no=11 AND trifecta_result='1-2-3'
    AND trifecta_payout=1230 AND result_status='confirmed' AND race_status='finished')
 THEN RAISE EXCEPTION 'confirmed result missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.bs_race_events
  WHERE race_date=d AND course_code=9 AND race_no=11
    AND result_available IS TRUE AND trifecta='1-2-3' AND trifecta_payout=1230)
 THEN RAISE EXCEPTION 'event settlement missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.bs_race_entries
  WHERE race_date=d AND course_code=9 AND race_no=11 AND boat_no=1
    AND arrival_order=1 AND actual_start_timing=0.12 AND actual_st=0.12)
 THEN RAISE EXCEPTION 'entry finish missing'; END IF;
 -- An empty/unsettled race must not manufacture a confirmed result.
 v:=public.bs_apply_openapi_results(
  jsonb_build_array(jsonb_build_object('race_date',d,'course_code',9,'race_no',12)),
  '[]'::jsonb,t);
 IF (v->>'result_rows')::int<>0 THEN RAISE EXCEPTION 'unsettled race confirmed'; END IF;
 -- Replaying the confirmed result is an upsert, not a second row.
 PERFORM public.bs_apply_openapi_results(
   jsonb_build_array(jsonb_build_object('race_date',d,'course_code',9,'race_no',11,
     'trifecta_result','1-2-3','trifecta_payout',1230,'first_boat',1)),
   '[]'::jsonb,t);
 SELECT count(*) INTO n FROM public.bs_race_results
   WHERE race_date=d AND course_code=9 AND race_no=11;
 IF n<>1 THEN RAISE EXCEPTION 'result replay duplicated rows'; END IF;
 RAISE NOTICE 'Captured real results writer PASS: confirmed result, event payout, boat finish, partial settlement, replay';
END $t$;
