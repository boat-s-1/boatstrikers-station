-- Disposable PostgreSQL 17 only: real captured production writer bodies
-- called by the candidate atomic RPC in a single transaction.
DO $t$
DECLARE d date:=(now() AT TIME ZONE 'Asia/Tokyo')::date;
 t timestamptz:=now(); ev jsonb; en jsonb; pe jsonb; pw jsonb; rs jsonb; re jsonb;
 v jsonb; n integer;
BEGIN
 ev:=jsonb_build_array(jsonb_build_object('race_date',d,'course_code',10,
   'race_no',1,'course_name','fixture course'));
 SELECT jsonb_agg(jsonb_build_object('race_date',d,'course_code',10,'race_no',1,
   'boat_no',b,'racer_registration_no',lpad((2000+b)::text,5,'0')))
 INTO en FROM generate_series(1,6) b;
 pe:=jsonb_build_array(jsonb_build_object('race_date',d,'course_code',10,
   'race_no',1,'boat_no',1,'exhibition_time',6.65,'exhibition_st',0.11));
 pw:=jsonb_build_array(jsonb_build_object('race_date',d,'course_code',10,
   'race_no',1,'wind_speed',2,'wave_height',3));
 rs:=jsonb_build_array(jsonb_build_object('race_date',d,'course_code',10,
   'race_no',1,'trifecta_result','1-2-3','trifecta_payout',1320,
   'first_boat',1,'second_boat',2,'third_boat',3));
 re:=jsonb_build_array(jsonb_build_object('race_date',d,'course_code',10,
   'race_no',1,'boat_no',1,'arrival_order',1,'actual_st',0.12));
 v:=public.bs_apply_openapi_atomic_candidate(d,ev,en,pe,pw,rs,re,t);
 IF (v->'bootstrap'->>'event_inserted')::int<>1
    OR (v->'bootstrap'->>'entry_inserted')::int<>6
    OR (v->'preview_entries'->>'updated_rows')::int<>1
    OR (v->'preview_events'->>'updated_rows')::int<>1
    OR (v->'results'->>'result_rows')::int<>1
    OR (v->'results'->>'result_entry_rows')::int<>1
 THEN RAISE EXCEPTION 'real four-writer count mismatch: %',v; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.bs_race_events
   WHERE race_date=d AND course_code=10 AND race_no=1
    AND trifecta='1-2-3' AND trifecta_payout=1320 AND wave_height=3)
 THEN RAISE EXCEPTION 'real atomic event incomplete'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.bs_race_entries
   WHERE race_date=d AND course_code=10 AND race_no=1 AND boat_no=1
    AND api_exhibition_time=6.65 AND arrival_order=1 AND actual_st=0.12)
 THEN RAISE EXCEPTION 'real atomic entry incomplete'; END IF;
 SELECT count(*) INTO n FROM public.bs_race_entries
   WHERE race_date=d AND course_code=10 AND race_no=1;
 IF n<>6 THEN RAISE EXCEPTION 'real atomic boat count: %',n; END IF;
 v:=public.bs_apply_openapi_atomic_candidate(d,ev,en,pe,pw,rs,re,t);
 IF (v->'bootstrap'->>'event_inserted')::int<>0
    OR (v->'bootstrap'->>'entry_inserted')::int<>0
 THEN RAISE EXCEPTION 'real atomic replay duplicate bootstrap: %',v; END IF;
 SELECT count(*) INTO n FROM public.bs_race_results
   WHERE race_date=d AND course_code=10 AND race_no=1;
 IF n<>1 THEN RAISE EXCEPTION 'real atomic replay duplicate result'; END IF;
 -- A malformed result payout must roll back bootstrap and preview writes.
 ev:=jsonb_build_array(jsonb_build_object('race_date',d,'course_code',10,'race_no',2));
 SELECT jsonb_agg(jsonb_build_object('race_date',d,'course_code',10,'race_no',2,
   'boat_no',b,'racer_registration_no',lpad((2100+b)::text,5,'0')))
 INTO en FROM generate_series(1,6) b;
 BEGIN
   PERFORM public.bs_apply_openapi_atomic_candidate(d,ev,en,
     jsonb_build_array(jsonb_build_object('race_date',d,'course_code',10,'race_no',2,
       'boat_no',1,'exhibition_time',6.55)),
     '[]'::jsonb,
     jsonb_build_array(jsonb_build_object('race_date',d,'course_code',10,'race_no',2,
       'trifecta_result','1-2-3','trifecta_payout','not-an-integer')),
     '[]'::jsonb,t);
   RAISE EXCEPTION 'malformed result payout accepted';
 EXCEPTION WHEN invalid_text_representation THEN NULL;
 END;
 IF EXISTS(SELECT 1 FROM public.bs_race_events
   WHERE race_date=d AND course_code=10 AND race_no=2)
 OR EXISTS(SELECT 1 FROM public.bs_race_entries
   WHERE race_date=d AND course_code=10 AND race_no=2)
 OR EXISTS(SELECT 1 FROM public.bs_race_results
   WHERE race_date=d AND course_code=10 AND race_no=2)
 THEN RAISE EXCEPTION 'real four-writer transaction rollback failed'; END IF;
 -- Simulate a downstream trigger silently discarding one boat INSERT.
 -- The writer may return successfully, but persisted completeness must fail.
 EXECUTE 'CREATE FUNCTION public.pr298_suppress_boat_insert() RETURNS trigger LANGUAGE plpgsql AS $body$ BEGIN IF NEW.boat_no=6 AND NEW.race_no=3 THEN RETURN NULL; END IF; RETURN NEW; END $body
END $t$;
;
 EXECUTE 'CREATE TRIGGER pr298_suppress_boat BEFORE INSERT ON public.bs_race_entries FOR EACH ROW EXECUTE FUNCTION public.pr298_suppress_boat_insert()';
 ev:=jsonb_build_array(jsonb_build_object('race_date',d,'course_code',10,'race_no',3));
 SELECT jsonb_agg(jsonb_build_object('race_date',d,'course_code',10,'race_no',3,
   'boat_no',b,'racer_registration_no',lpad((2200+b)::text,5,'0')))
 INTO en FROM generate_series(1,6) b;
 BEGIN
   PERFORM public.bs_apply_openapi_atomic_candidate(d,ev,en,
     '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,t);
   RAISE EXCEPTION 'incomplete persisted program accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT LIKE 'OpenAPI persisted program incomplete:%' THEN RAISE; END IF;
 END;
 IF EXISTS(SELECT 1 FROM public.bs_race_events WHERE race_date=d AND course_code=10 AND race_no=3)
 OR EXISTS(SELECT 1 FROM public.bs_race_entries WHERE race_date=d AND course_code=10 AND race_no=3)
 THEN RAISE EXCEPTION 'suppressed entry did not roll back whole atomic transaction'; END IF;
 EXECUTE 'DROP TRIGGER pr298_suppress_boat ON public.bs_race_entries';
 EXECUTE 'DROP FUNCTION public.pr298_suppress_boat_insert()';
 RAISE NOTICE 'REAL FOUR WRITERS PASS: atomic ordering, replay, complete settlement, late failure rollback';
END $t$;
