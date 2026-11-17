-- Run after captured bootstrap function installed, in disposable CI DB.
DO $test$
DECLARE d date := (now() AT TIME ZONE 'Asia/Tokyo')::date;
 ev jsonb; en jsonb; result jsonb; n int;
BEGIN
 ev := jsonb_build_array(jsonb_build_object('race_date',d,'course_code',9,'race_no',1,'course_name','fixture'));
 SELECT jsonb_agg(jsonb_build_object('race_date',d,'course_code',9,'race_no',1,
    'boat_no',b,'racer_registration_no',lpad((1000+b)::text,5,'0')))
 INTO en FROM generate_series(1,6) b;
 result := public.bs_apply_openapi_bootstrap(ev,en,now());
 IF (result->>'event_inserted')::int <> 1 OR (result->>'entry_inserted')::int <> 6 THEN
   RAISE EXCEPTION 'captured bootstrap first write unexpected: %',result;
 END IF;
 result := public.bs_apply_openapi_bootstrap(ev,en,now());
 IF (result->>'event_inserted')::int <> 0 OR (result->>'entry_inserted')::int <> 0 THEN
   RAISE EXCEPTION 'captured bootstrap replay not idempotent: %',result;
 END IF;
 IF (SELECT count(*) FROM public.bs_race_entries WHERE race_date=d AND course_code=9 AND race_no=1)<>6 THEN
   RAISE EXCEPTION 'captured bootstrap lost six-boat program';
 END IF;
 -- Invalid numeric must roll back event and entry inserts in the RPC statement.
 BEGIN
   PERFORM public.bs_apply_openapi_bootstrap(
     jsonb_build_array(jsonb_build_object('race_date',d,'course_code',9,'race_no',2)),
     jsonb_build_array(jsonb_build_object('race_date',d,'course_code',9,'race_no',2,
        'boat_no',1,'national_win_rate','not-a-number')),now());
   RAISE EXCEPTION 'malformed numeric unexpectedly accepted';
 EXCEPTION WHEN invalid_text_representation THEN NULL;
 END;
 IF EXISTS (SELECT 1 FROM public.bs_race_events WHERE race_date=d AND race_no=2) THEN
   RAISE EXCEPTION 'captured bootstrap failed to roll back malformed payload';
 END IF;
 RAISE NOTICE 'Captured production bootstrap PASS: 1+6, replay 0+0, malformed rollback';
END $test$;
