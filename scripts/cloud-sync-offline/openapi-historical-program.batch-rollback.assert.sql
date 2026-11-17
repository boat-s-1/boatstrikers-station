-- Disposable PostgreSQL CI only. A mixed batch must roll back every
-- earlier race when a later race has a conflicting stored identity.
DO $test$
DECLARE d date:=DATE '2026-11-16'; ev jsonb; en jsonb;
 failure boolean:=false;
BEGIN
 INSERT INTO public.bs_race_events(id,race_date,course_code,race_no)
 VALUES(991201,d,11,2);
 INSERT INTO public.bs_race_entries(id,race_date,course_code,race_no,boat_no,racer_registration_no)
 VALUES(991202,d,11,2,1,'09999');
 ev:=jsonb_build_array(
  jsonb_build_object('race_date',d,'course_code',11,'race_no',1),
  jsonb_build_object('race_date',d,'course_code',11,'race_no',2));
 SELECT jsonb_agg(jsonb_build_object('race_date',d,'course_code',11,
   'race_no',r,'boat_no',b,'racer_registration_no',
   lpad((r*1000+b)::text,5,'0'))) INTO en
 FROM generate_series(1,2) r CROSS JOIN generate_series(1,6) b;
 BEGIN
  PERFORM public.bs_apply_openapi_historical_program_candidate(d,ev,en,now());
 EXCEPTION WHEN OTHERS THEN failure:=true;
 END;
 IF NOT failure THEN RAISE EXCEPTION 'conflicting identity unexpectedly accepted'; END IF;
 IF EXISTS(SELECT 1 FROM public.bs_race_events
   WHERE race_date=d AND course_code=11 AND race_no=1)
 OR EXISTS(SELECT 1 FROM public.bs_race_entries
   WHERE race_date=d AND course_code=11 AND race_no=1) THEN
  RAISE EXCEPTION 'earlier race persisted despite later identity conflict';
 END IF;
 IF (SELECT count(*) FROM public.bs_race_entries
   WHERE race_date=d AND course_code=11 AND race_no=2)<>1
 OR (SELECT racer_registration_no FROM public.bs_race_entries
   WHERE race_date=d AND course_code=11 AND race_no=2 AND boat_no=1)<>'09999' THEN
  RAISE EXCEPTION 'existing authoritative identity was changed';
 END IF;
 RAISE NOTICE 'Historical batch rollback PASS: two-race conflict rejected, first race rolled back, existing identity intact';
END $test$;
