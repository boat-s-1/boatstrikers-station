-- Disposable PostgreSQL 17 only. This fixture reproduces the *actual*
-- production trigger_evaluate_ichika_escape_surge_alerts() body and trigger
-- condition; the downstream evaluator is replaced by an observable stub.
-- No external notification, production data or network call.
CREATE TABLE public.atomic_trigger_events(
 race_date date NOT NULL, course_code smallint NOT NULL, race_no smallint NOT NULL,
 PRIMARY KEY(race_date,course_code,race_no));
CREATE TABLE public.atomic_trigger_entries(
 race_date date NOT NULL, course_code smallint NOT NULL, race_no smallint NOT NULL,
 boat_no smallint NOT NULL, official_exhibition_time numeric, exhibition_time numeric,
 official_lap numeric, lap_time numeric,
 PRIMARY KEY(race_date,course_code,race_no,boat_no));
CREATE TABLE public.atomic_ichika_evaluation_calls(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY);
CREATE OR REPLACE FUNCTION public.evaluate_ichika_escape_surge_alerts()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN INSERT INTO public.atomic_ichika_evaluation_calls DEFAULT VALUES; END $$;
CREATE OR REPLACE FUNCTION public.trigger_evaluate_ichika_escape_surge_alerts()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
 IF new.race_date = (now() at time zone 'Asia/Tokyo')::date THEN
   PERFORM public.evaluate_ichika_escape_surge_alerts();
 END IF;
 RETURN new;
END $$;
CREATE TRIGGER trg_ichika_escape_surge_on_exhibition_update
AFTER INSERT OR UPDATE OF official_exhibition_time, exhibition_time, official_lap, lap_time
ON public.atomic_trigger_entries FOR EACH ROW
EXECUTE FUNCTION public.trigger_evaluate_ichika_escape_surge_alerts();

DO $t$
DECLARE d date := (now() AT TIME ZONE 'Asia/Tokyo')::date; n int;
BEGIN
 INSERT INTO atomic_trigger_events VALUES (d,9,1);
 INSERT INTO atomic_trigger_entries(race_date,course_code,race_no,boat_no)
 SELECT d,9,1,b FROM generate_series(1,6) b;
 SELECT count(*) INTO n FROM atomic_ichika_evaluation_calls;
 IF n<>6 THEN RAISE EXCEPTION 'expected 6 Ichika evaluations on six boat inserts, got %',n; END IF;
 -- A failed outer transaction must roll back all trigger side effects.
 BEGIN
   INSERT INTO atomic_trigger_entries(race_date,course_code,race_no,boat_no)
   SELECT d,9,2,b FROM generate_series(1,6) b;
   RAISE EXCEPTION 'force rollback after six entry triggers';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM<>'force rollback after six entry triggers' THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM atomic_trigger_entries)<>6
    OR (SELECT count(*) FROM atomic_ichika_evaluation_calls)<>6 THEN
   RAISE EXCEPTION 'trigger side effects were not rolled back';
 END IF;
 -- Old-day backfill must not invoke current-day evaluator.
 INSERT INTO atomic_trigger_entries(race_date,course_code,race_no,boat_no)
 SELECT d-1,9,3,b FROM generate_series(1,6) b;
 IF (SELECT count(*) FROM atomic_ichika_evaluation_calls)<>6 THEN
   RAISE EXCEPTION 'historical entry triggered current-day evaluator';
 END IF;
 RAISE NOTICE 'Production Ichika trigger body fixture PASS: 6 per race, transactional rollback, historical no-call';
END $t$;
