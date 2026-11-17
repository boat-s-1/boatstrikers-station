-- Disposable PostgreSQL fixture: a trigger that changes a persisted racer ID
-- must be detected by the atomic candidate, rolling back the entire race.
CREATE FUNCTION public.pr298_mutate_racer_identity() RETURNS trigger
LANGUAGE plpgsql AS 'BEGIN IF NEW.boat_no=6 AND NEW.race_no=4 THEN NEW.racer_registration_no := ''99999''; END IF; RETURN NEW; END;';
CREATE TRIGGER pr298_mutate_racer BEFORE INSERT OR UPDATE ON public.bs_race_entries
FOR EACH ROW EXECUTE FUNCTION public.pr298_mutate_racer_identity();
DO $test$
DECLARE d date:=(now() at time zone 'Asia/Tokyo')::date;
 t timestamptz:=now(); ev jsonb; en jsonb;
BEGIN
 ev:=jsonb_build_array(jsonb_build_object('race_date',d,'course_code',10,'race_no',4));
 SELECT jsonb_agg(jsonb_build_object('race_date',d,'course_code',10,'race_no',4,
   'boat_no',b,'racer_registration_no',lpad((2300+b)::text,5,'0')))
 INTO en FROM generate_series(1,6) b;
 BEGIN
   PERFORM public.bs_apply_openapi_atomic_candidate(d,ev,en,
     '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,t);
   RAISE EXCEPTION 'mismatched persisted racer identity accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT LIKE 'OpenAPI persisted program incomplete:%' THEN RAISE; END IF;
 END;
 IF EXISTS(SELECT 1 FROM public.bs_race_events WHERE race_date=d AND course_code=10 AND race_no=4)
 OR EXISTS(SELECT 1 FROM public.bs_race_entries WHERE race_date=d AND course_code=10 AND race_no=4)
 THEN RAISE EXCEPTION 'mutated racer identity did not roll back entire race'; END IF;
 RAISE NOTICE 'Persisted racer identity mismatch rollback PASS';
END $test$;
DROP TRIGGER pr298_mutate_racer ON public.bs_race_entries;
DROP FUNCTION public.pr298_mutate_racer_identity();
