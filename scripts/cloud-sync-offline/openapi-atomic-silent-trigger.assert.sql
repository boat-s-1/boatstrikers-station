-- Disposable PostgreSQL fixture only: silently suppressed sixth boat must fail.
CREATE FUNCTION public.pr298_suppress_boat_insert() RETURNS trigger
LANGUAGE plpgsql AS 'BEGIN IF NEW.boat_no=6 AND NEW.race_no=3 THEN RETURN NULL; END IF; RETURN NEW; END;';
CREATE TRIGGER pr298_suppress_boat BEFORE INSERT ON public.bs_race_entries
FOR EACH ROW EXECUTE FUNCTION public.pr298_suppress_boat_insert();
DO $test$
DECLARE d date:=(now() at time zone 'Asia/Tokyo')::date;
 t timestamptz:=now(); ev jsonb; en jsonb;
BEGIN
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
 THEN RAISE EXCEPTION 'suppressed entry did not roll back whole transaction'; END IF;
 RAISE NOTICE 'Silent trigger-discard rollback PASS';
END $test$;
DROP TRIGGER pr298_suppress_boat ON public.bs_race_entries;
DROP FUNCTION public.pr298_suppress_boat_insert();
