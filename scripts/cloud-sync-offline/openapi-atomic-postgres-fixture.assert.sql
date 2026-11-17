-- Disposable PostgreSQL only; validates actual transactional rollback.
DO $t$
DECLARE d date:=(now() AT TIME ZONE 'Asia/Tokyo')::date;
 ev jsonb; en jsonb; v jsonb; n integer; phases text[];
BEGIN
 SELECT jsonb_agg(jsonb_build_object('race_date',d,'course_code',9,'race_no',1)) INTO ev;
 SELECT jsonb_agg(jsonb_build_object('race_date',d,'course_code',9,'race_no',1,
 'boat_no',b,'racer_registration_no',lpad((1000+b)::text,4,'0')))
 INTO en FROM generate_series(1,6) b;
 -- Production read-only catalog: Nov 11-12 registration IDs are 5-digit
 -- numeric strings with leading zero; ensure this valid form is accepted.
 SELECT jsonb_agg(jsonb_build_object('race_date',d,'course_code',9,'race_no',1,
 'boat_no',b,'racer_registration_no',lpad((1000+b)::text,5,'0')))
 INTO en FROM generate_series(1,6) b;
 PERFORM set_config('bs_fixture.fail_results','yes',true);
 BEGIN
   PERFORM bs_apply_openapi_atomic_candidate(d,ev,en,'[]'::jsonb,'[]'::jsonb,
     '[]'::jsonb,'[]'::jsonb,now());
   RAISE EXCEPTION 'failure injection not propagated';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='failure injection not propagated' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%injected results failure%' THEN RAISE; END IF;
 END;
 SELECT count(*) INTO n FROM atomic_fixture_writes;
 IF n<>0 THEN RAISE EXCEPTION 'atomic rollback failed: % writes persisted',n; END IF;
 PERFORM set_config('bs_fixture.fail_results','no',true);
 v:=bs_apply_openapi_atomic_candidate(d,ev,en,'[]'::jsonb,'[]'::jsonb,
   '[]'::jsonb,'[]'::jsonb,now());
 SELECT array_agg(phase ORDER BY ctid) INTO phases FROM atomic_fixture_writes;
 IF phases IS DISTINCT FROM ARRAY['bootstrap','preview_entries','preview_events','results']
 THEN RAISE EXCEPTION 'atomic order mismatch: %',phases; END IF;
 BEGIN
   PERFORM bs_apply_openapi_atomic_candidate(d,ev,'[]'::jsonb,'[]'::jsonb,
     '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,now());
   RAISE EXCEPTION 'invalid boats accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='invalid boats accepted' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%program count invalid%' THEN RAISE; END IF;
 END;
 -- A conflicting incoming trifecta must be rejected before any writer,
 -- preserving the existing confirmed result and phase-call count.
 INSERT INTO public.bs_race_results(race_date,course_code,race_no,
   trifecta_result,trifecta_payout)
 VALUES(d,9,1,'1-2-3',1200);
 BEGIN
   PERFORM bs_apply_openapi_atomic_candidate(d,ev,en,'[]'::jsonb,
     '[]'::jsonb,jsonb_build_array(jsonb_build_object(
       'race_date',d,'course_code',9,'race_no',1,
       'trifecta_result','1-3-2','trifecta_payout',1200)),
     '[]'::jsonb,now());
   RAISE EXCEPTION 'contradictory confirmed result accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='contradictory confirmed result accepted' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%result conflicts with persisted result%' THEN RAISE; END IF;
 END;
 IF (SELECT trifecta_result FROM public.bs_race_results
    WHERE race_date=d AND course_code=9 AND race_no=1)<>'1-2-3'
    OR (SELECT count(*) FROM atomic_fixture_writes)<>4 THEN
   RAISE EXCEPTION 'confirmed-result conflict mutated database or called writer';
 END IF;
 BEGIN
   PERFORM bs_apply_openapi_atomic_candidate(d,ev,en,'[]'::jsonb,
     '[]'::jsonb,jsonb_build_array(jsonb_build_object(
       'race_date',d,'course_code',9,'race_no',1,
       'trifecta_result','1-2-3','trifecta_payout',9999)),
     '[]'::jsonb,now());
   RAISE EXCEPTION 'contradictory confirmed payout accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='contradictory confirmed payout accepted' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%result conflicts with persisted result%' THEN RAISE; END IF;
 END;
 IF (SELECT trifecta_payout FROM public.bs_race_results
    WHERE race_date=d AND course_code=9 AND race_no=1)<>1200
    OR (SELECT count(*) FROM atomic_fixture_writes)<>4 THEN
   RAISE EXCEPTION 'confirmed-payout conflict mutated database or called writer';
 END IF;
 -- Additional immutable result surfaces: exacta, placements, technique.
 UPDATE public.bs_race_events SET exacta='1-2',exacta_payout=550,
   winning_technique_code='1' WHERE race_date=d AND course_code=9 AND race_no=1;
 UPDATE public.bs_race_results SET first_boat=1,winning_method='escape'
   WHERE race_date=d AND course_code=9 AND race_no=1;
 BEGIN
   PERFORM bs_apply_openapi_atomic_candidate(d,ev,en,'[]'::jsonb,
     '[]'::jsonb,jsonb_build_array(jsonb_build_object(
       'race_date',d,'course_code',9,'race_no',1,'exacta','1-3')),
     '[]'::jsonb,now());
   RAISE EXCEPTION 'contradictory exacta accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='contradictory exacta accepted' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%result conflicts with persisted result%' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM bs_apply_openapi_atomic_candidate(d,ev,en,'[]'::jsonb,
     '[]'::jsonb,jsonb_build_array(jsonb_build_object(
       'race_date',d,'course_code',9,'race_no',1,'first_boat',2)),
     '[]'::jsonb,now());
   RAISE EXCEPTION 'contradictory first boat accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='contradictory first boat accepted' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%result conflicts with persisted result%' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM bs_apply_openapi_atomic_candidate(d,ev,en,'[]'::jsonb,
     '[]'::jsonb,jsonb_build_array(jsonb_build_object(
       'race_date',d,'course_code',9,'race_no',1,'technique_code','2')),
     '[]'::jsonb,now());
   RAISE EXCEPTION 'contradictory technique accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='contradictory technique accepted' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%result conflicts with persisted result%' THEN RAISE; END IF;
 END;
 IF (SELECT exacta FROM public.bs_race_events WHERE race_date=d AND course_code=9 AND race_no=1)<>'1-2'
   OR (SELECT first_boat FROM public.bs_race_results WHERE race_date=d AND course_code=9 AND race_no=1)<>1
   OR (SELECT count(*) FROM atomic_fixture_writes)<>4 THEN
   RAISE EXCEPTION 'extended result conflict mutated data or called writer';
 END IF;
 -- Existing boat result must not be overwritten by contradictory finish
 -- placement or actual start timing.
 UPDATE public.bs_race_entries SET arrival_order=1,actual_st=0.12,
   actual_start_timing=0.12 WHERE race_date=d AND course_code=9
   AND race_no=1 AND boat_no=1;
 BEGIN
   PERFORM bs_apply_openapi_atomic_candidate(d,ev,en,'[]'::jsonb,
     '[]'::jsonb,'[]'::jsonb,
     jsonb_build_array(jsonb_build_object('race_date',d,'course_code',9,
       'race_no',1,'boat_no',1,'arrival_order',2)),now());
   RAISE EXCEPTION 'contradictory boat placement accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='contradictory boat placement accepted' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%boat result conflicts with persisted result%' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM bs_apply_openapi_atomic_candidate(d,ev,en,'[]'::jsonb,
     '[]'::jsonb,'[]'::jsonb,
     jsonb_build_array(jsonb_build_object('race_date',d,'course_code',9,
       'race_no',1,'boat_no',1,'actual_st',0.25)),now());
   RAISE EXCEPTION 'contradictory boat timing accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='contradictory boat timing accepted' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%boat result conflicts with persisted result%' THEN RAISE; END IF;
 END;
 IF (SELECT arrival_order FROM public.bs_race_entries WHERE race_date=d
    AND course_code=9 AND race_no=1 AND boat_no=1)<>1
    OR (SELECT count(*) FROM atomic_fixture_writes)<>4 THEN
   RAISE EXCEPTION 'boat result conflict mutated data or called writer';
 END IF;
 -- NULL and malformed registration IDs must fail before any RPC.
 BEGIN
   PERFORM bs_apply_openapi_atomic_candidate(d,ev,
     jsonb_set(en,'{0,racer_registration_no}','null'::jsonb),
     '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,now());
   RAISE EXCEPTION 'NULL registration accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='NULL registration accepted' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%program keys/boat identities%' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM bs_apply_openapi_atomic_candidate(d,ev,
     jsonb_set(en,'{0,racer_registration_no}','"00000"'::jsonb),
     '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,now());
   RAISE EXCEPTION 'all-zero registration accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='all-zero registration accepted' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%program keys/boat identities%' THEN RAISE; END IF;
 END;
 -- Captured production bootstrap silently filters boat 7. The atomic
 -- wrapper must reject that payload BEFORE invoking any of its four RPCs.
 BEGIN
   PERFORM bs_apply_openapi_atomic_candidate(d,ev,
     jsonb_set(en,'{5,boat_no}','7'::jsonb),
     '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,now());
   RAISE EXCEPTION 'boat 7 accepted by atomic guard';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='boat 7 accepted by atomic guard' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%program keys/boat identities%' THEN RAISE; END IF;
 END;
 -- Duplicating a racer across two boats is invalid even when six
 -- distinct boat numbers are present.
 BEGIN
   PERFORM bs_apply_openapi_atomic_candidate(d,ev,
     jsonb_set(en,'{5,racer_registration_no}',en->0->'racer_registration_no'),
     '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,now());
   RAISE EXCEPTION 'duplicate racer accepted by atomic guard';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='duplicate racer accepted by atomic guard' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%program keys/boat identities%' THEN RAISE; END IF;
 END;
 -- Reject a stale capture timestamp and a future capture timestamp before
 -- calling any of the four writers.
 BEGIN
   PERFORM bs_apply_openapi_atomic_candidate(d,ev,en,'[]'::jsonb,
     '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,now()-interval '16 minutes');
   RAISE EXCEPTION 'stale capture timestamp accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='stale capture timestamp accepted' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%invalid OpenAPI capture timestamp%' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM bs_apply_openapi_atomic_candidate(d,ev,en,'[]'::jsonb,
     '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,now()+interval '6 minutes');
   RAISE EXCEPTION 'future capture timestamp accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='future capture timestamp accepted' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%invalid OpenAPI capture timestamp%' THEN RAISE; END IF;
 END;
 -- A wrong JST date must not write even when all six boats are present.
 BEGIN
   PERFORM bs_apply_openapi_atomic_candidate(d-1,ev,en,'[]'::jsonb,
     '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,now());
   RAISE EXCEPTION 'past date accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='past date accepted' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%current JST date only%' THEN RAISE; END IF;
 END;
 -- Wrong race and duplicate dependent payload keys must fail before any RPC.
 BEGIN
   PERFORM bs_apply_openapi_atomic_candidate(d,ev,en,'[]'::jsonb,
     '[]'::jsonb,jsonb_build_array(jsonb_build_object('race_date',d,
       'course_code',9,'race_no',2)),'[]'::jsonb,now());
   RAISE EXCEPTION 'wrong result race accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='wrong result race accepted' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%dependent payload%' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM bs_apply_openapi_atomic_candidate(d,ev,en,'[]'::jsonb,
     '[]'::jsonb,'[]'::jsonb,
     jsonb_build_array(
       jsonb_build_object('race_date',d,'course_code',9,'race_no',1,'boat_no',1),
       jsonb_build_object('race_date',d,'course_code',9,'race_no',1,'boat_no',1)),
     now());
   RAISE EXCEPTION 'duplicate result boat accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='duplicate result boat accepted' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%dependent payload%' THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM atomic_fixture_writes)<>4 THEN
   RAISE EXCEPTION 'invalid payload caused writes';
 END IF;
 RAISE NOTICE 'Atomic OpenAPI transaction, rollback, ordering, validation PASS';
END $t$;

-- Candidate RPC is service-role-only even though dependent RPCs are stubs.
DO $security$
DECLARE fn regprocedure := 'public.bs_apply_openapi_atomic_candidate(date,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,timestamp with time zone)'::regprocedure;
BEGIN
 IF has_function_privilege('anon',fn,'EXECUTE')
 OR has_function_privilege('authenticated',fn,'EXECUTE')
 OR NOT has_function_privilege('service_role',fn,'EXECUTE') THEN
   RAISE EXCEPTION 'atomic RPC EXECUTE grants violate service-role-only policy';
 END IF;
 RAISE NOTICE 'Atomic OpenAPI RPC role grant fixture PASS';
END $security$;
