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
 official_lap numeric, lap_time numeric, note text,
 PRIMARY KEY(race_date,course_code,race_no,boat_no));
CREATE TABLE public.atomic_ichika_evaluation_calls(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY);
CREATE OR REPLACE FUNCTION public.evaluate_ichika_escape_surge_alerts()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('bs_fixture.fail_ichika',true)='yes' THEN
   RAISE EXCEPTION 'fixture injected Ichika evaluator failure';
 END IF;
 INSERT INTO public.atomic_ichika_evaluation_calls DEFAULT VALUES;
END $;
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
 -- Updates to unrelated fields must not invoke the column-filtered trigger.
 UPDATE atomic_trigger_entries SET note='non-exhibition' WHERE race_date=d AND race_no=1;
 IF (SELECT count(*) FROM atomic_ichika_evaluation_calls)<>6 THEN
   RAISE EXCEPTION 'unrelated update unexpectedly invoked Ichika evaluator';
 END IF;
 -- Updating a monitored field invokes the trigger once per row, even when
 -- the supplied value is unchanged. This is a potential replay fan-out.
 UPDATE atomic_trigger_entries SET exhibition_time=exhibition_time
 WHERE race_date=d AND race_no=1;
 IF (SELECT count(*) FROM atomic_ichika_evaluation_calls)<>12 THEN
   RAISE EXCEPTION 'expected six more evaluations on monitored-field replay update';
 END IF;
 -- Historical monitored-field updates must still skip today's evaluator.
 UPDATE atomic_trigger_entries SET exhibition_time=exhibition_time
 WHERE race_date=d-1 AND race_no=3;
 IF (SELECT count(*) FROM atomic_ichika_evaluation_calls)<>12 THEN
   RAISE EXCEPTION 'historical exhibition update invoked current-day evaluator';
 END IF;
 -- Failure inside the evaluator must reject the entry statement and roll back
 -- the parent event plus all six entries when the caller uses one transaction.
 BEGIN
   PERFORM set_config('bs_fixture.fail_ichika','yes',true);
   INSERT INTO atomic_trigger_events VALUES (d,9,4);
   INSERT INTO atomic_trigger_entries(race_date,course_code,race_no,boat_no)
   SELECT d,9,4,b FROM generate_series(1,6) b;
   RAISE EXCEPTION 'expected evaluator failure was not raised';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'fixture injected Ichika evaluator failure' THEN RAISE; END IF;
 END;
 IF EXISTS (SELECT 1 FROM atomic_trigger_events WHERE race_no=4)
    OR EXISTS (SELECT 1 FROM atomic_trigger_entries WHERE race_no=4)
    OR (SELECT count(*) FROM atomic_ichika_evaluation_calls)<>12 THEN
   RAISE EXCEPTION 'evaluator failure leaked event, entries or side effects';
 END IF;
 RAISE NOTICE 'Production Ichika trigger body fixture PASS: inserts 6, unrelated update 0, monitored replay +6, rollback, evaluator failure atomic, historical no-call';
END $t$;
