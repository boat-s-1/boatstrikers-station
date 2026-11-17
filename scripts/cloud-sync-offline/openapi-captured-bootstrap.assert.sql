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
 -- A pre-existing event with only two entries must be repaired by bootstrap
 -- without replacing its authoritative event metadata.
 INSERT INTO public.bs_race_events(id,race_date,course_code,race_no,course_name)
 VALUES (999001,d,9,3,'EXISTING_AUTHORITATIVE');
 INSERT INTO public.bs_race_entries(id,race_date,course_code,race_no,boat_no,racer_registration_no)
 VALUES (999002,d,9,3,1,'00999'),(999003,d,9,3,2,'00998');
 result := public.bs_apply_openapi_bootstrap(
   jsonb_build_array(jsonb_build_object('race_date',d,'course_code',9,'race_no',3,'course_name','OVERWRITE_ATTEMPT')),
   (SELECT jsonb_agg(jsonb_build_object('race_date',d,'course_code',9,'race_no',3,
     'boat_no',b,'racer_registration_no',lpad((2000+b)::text,5,'0')))
    FROM generate_series(1,6) b),now());
 IF (result->>'event_inserted')::int <> 0 OR (result->>'entry_inserted')::int <> 4 THEN
   RAISE EXCEPTION 'captured bootstrap partial repair count unexpected: %',result;
 END IF;
 IF (SELECT course_name FROM public.bs_race_events WHERE race_date=d AND race_no=3)
    IS DISTINCT FROM 'EXISTING_AUTHORITATIVE' THEN
   RAISE EXCEPTION 'captured bootstrap overwrote authoritative event';
 END IF;
 IF (SELECT count(*) FROM public.bs_race_entries WHERE race_date=d AND race_no=3)<>6
    OR (SELECT racer_registration_no FROM public.bs_race_entries
        WHERE race_date=d AND race_no=3 AND boat_no=1)<>'00999' THEN
   RAISE EXCEPTION 'captured bootstrap damaged existing entries during partial repair';
 END IF;
 -- A missing parent race is not silently invented by entry payload.
 BEGIN
   PERFORM public.bs_apply_openapi_bootstrap(
     '[]'::jsonb,
     jsonb_build_array(jsonb_build_object('race_date',d,'course_code',9,
       'race_no',5,'boat_no',1,'racer_registration_no','02001')),now());
   RAISE EXCEPTION 'orphan entry accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 IF EXISTS (SELECT 1 FROM public.bs_race_entries WHERE race_date=d AND race_no=5) THEN
   RAISE EXCEPTION 'orphan entry persisted despite foreign key';
 END IF;
 -- An invalid entry in a later race must undo earlier race inserts
 -- from the same captured bootstrap invocation (cross-race atomicity).
 BEGIN
   PERFORM public.bs_apply_openapi_bootstrap(
     jsonb_build_array(
       jsonb_build_object('race_date',d,'course_code',9,'race_no',6),
       jsonb_build_object('race_date',d,'course_code',9,'race_no',7)),
     jsonb_build_array(
       jsonb_build_object('race_date',d,'course_code',9,'race_no',6,
         'boat_no',1,'racer_registration_no','02001'),
       jsonb_build_object('race_date',d,'course_code',9,'race_no',7,
         'boat_no',1,'national_win_rate','not-a-number')),now());
   RAISE EXCEPTION 'cross-race malformed entry unexpectedly accepted';
 EXCEPTION WHEN invalid_text_representation THEN NULL;
 END;
 IF EXISTS (SELECT 1 FROM public.bs_race_events
            WHERE race_date=d AND course_code=9 AND race_no IN (6,7))
    OR EXISTS (SELECT 1 FROM public.bs_race_entries
               WHERE race_date=d AND course_code=9 AND race_no IN (6,7)) THEN
   RAISE EXCEPTION 'cross-race rollback failed: partial event or entry persisted';
 END IF;
 -- Invalid boat numbers are filtered by the captured bootstrap RPC, not
 -- inserted into the destination table. Record this behavior explicitly.
 result := public.bs_apply_openapi_bootstrap(
   jsonb_build_array(jsonb_build_object('race_date',d,'course_code',9,'race_no',8)),
   jsonb_build_array(jsonb_build_object('race_date',d,'course_code',9,'race_no',8,
      'boat_no',7,'racer_registration_no','02007')),now());
 IF (result->>'event_inserted')::int <> 1 OR (result->>'entry_inserted')::int <> 0 THEN
   RAISE EXCEPTION 'unexpected invalid boat filtering behavior: %',result;
 END IF;
 RAISE NOTICE 'Captured production bootstrap PASS: 1+6, replay, malformed rollback, partial repair, metadata preservation, FK guard, cross-race rollback, invalid boat filtering';

END $test$;
