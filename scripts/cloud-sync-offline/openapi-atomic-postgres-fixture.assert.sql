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
