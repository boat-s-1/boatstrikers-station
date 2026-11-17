-- Disposable PostgreSQL only: realistic Ichika evaluator logic, no external calls.
-- The SELECT/INSERT logic below mirrors the production function observed
-- read-only on 2026-11-17; simplified columns and fixture-only tables.
CREATE TABLE public.pr298_real_events(
 race_date date, course_code int, race_no int, course_name text,
 closing_time time, deadline_time time,
 PRIMARY KEY(race_date,course_code,race_no));
CREATE TABLE public.pr298_real_entries(
 race_date date, course_code int, race_no int, boat_no int,
 official_exhibition_time numeric, exhibition_time numeric,
 official_lap numeric, lap_time numeric,
 national_win_rate numeric, local_win_rate numeric,
 PRIMARY KEY(race_date,course_code,race_no,boat_no));
CREATE TABLE public.pr298_real_alerts(
 race_date date, course_code int, race_no int, course_name text,
 closing_time time, exhibition_time numeric, lap_time numeric,
 recommended_second_boat int, recommended_second_national_win_rate numeric,
 PRIMARY KEY(race_date,course_code,race_no));
CREATE TABLE public.pr298_real_evaluations(n bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY);
CREATE OR REPLACE FUNCTION public.pr298_real_evaluate_ichika()
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE inserted_count integer := 0;
BEGIN
 INSERT INTO public.pr298_real_evaluations DEFAULT VALUES;
 WITH today_entries AS (
  SELECT e.race_date,e.course_code,e.race_no,e.boat_no,
   coalesce(e.official_exhibition_time,e.exhibition_time) AS exhibition_time,
   coalesce(e.official_lap,e.lap_time) AS lap_time,
   e.national_win_rate,e.local_win_rate
  FROM public.pr298_real_entries e
  WHERE e.race_date=(now() at time zone 'Asia/Tokyo')::date
 ), race_ready AS (
  SELECT race_date,course_code,race_no,min(exhibition_time) AS best_exhibition,
   min(lap_time) AS best_lap
  FROM today_entries GROUP BY race_date,course_code,race_no
  HAVING count(*) FILTER (WHERE exhibition_time IS NOT NULL AND lap_time IS NOT NULL)=6
 ), qualifying AS (
  SELECT t.race_date,t.course_code,t.race_no,t.exhibition_time,t.lap_time
  FROM today_entries t JOIN race_ready r USING(race_date,course_code,race_no)
  WHERE t.boat_no=1 AND t.exhibition_time=r.best_exhibition AND t.lap_time=r.best_lap
 ), recommended AS (
  SELECT DISTINCT ON (t.race_date,t.course_code,t.race_no)
   t.race_date,t.course_code,t.race_no,
   t.boat_no AS recommended_second_boat,
   t.national_win_rate AS recommended_second_national_win_rate
  FROM today_entries t JOIN qualifying q USING(race_date,course_code,race_no)
  WHERE t.boat_no BETWEEN 2 AND 6
  ORDER BY t.race_date,t.course_code,t.race_no,
   t.national_win_rate DESC NULLS LAST,t.local_win_rate DESC NULLS LAST,t.boat_no ASC
 ), inserted AS (
  INSERT INTO public.pr298_real_alerts(
   race_date,course_code,course_name,race_no,closing_time,
   exhibition_time,lap_time,recommended_second_boat,
   recommended_second_national_win_rate)
  SELECT q.race_date,q.course_code,ev.course_name,q.race_no,
   coalesce(ev.closing_time,ev.deadline_time),
   q.exhibition_time,q.lap_time,rec.recommended_second_boat,
   rec.recommended_second_national_win_rate
  FROM qualifying q
  LEFT JOIN public.pr298_real_events ev USING(race_date,course_code,race_no)
  LEFT JOIN recommended rec USING(race_date,course_code,race_no)
  ON CONFLICT(race_date,course_code,race_no) DO NOTHING RETURNING 1
 )
 SELECT count(*) INTO inserted_count FROM inserted;
 RETURN inserted_count;
END $$;
CREATE OR REPLACE FUNCTION public.pr298_real_trigger_ichika()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF new.race_date=(now() at time zone 'Asia/Tokyo')::date THEN
  PERFORM public.pr298_real_evaluate_ichika();
 END IF;
 RETURN new;
END $$;
CREATE TRIGGER pr298_real_ichika_trigger
AFTER INSERT OR UPDATE OF official_exhibition_time,exhibition_time,official_lap,lap_time
ON public.pr298_real_entries FOR EACH ROW
EXECUTE FUNCTION public.pr298_real_trigger_ichika();
DO $$
DECLARE d date := (now() AT TIME ZONE 'Asia/Tokyo')::date;
        started timestamptz := clock_timestamp(); calls bigint;
BEGIN
 INSERT INTO public.pr298_real_events
 SELECT d,c,r,'Fixture',time '15:00',time '15:00'
 FROM generate_series(1,12) c CROSS JOIN generate_series(1,12) r;
 -- Program-only bootstrap: each of 864 rows evaluates, but no false alerts.
 INSERT INTO public.pr298_real_entries(race_date,course_code,race_no,boat_no,
  national_win_rate,local_win_rate)
 SELECT d,c,r,b,50-b,40-b
 FROM generate_series(1,12) c CROSS JOIN generate_series(1,12) r
 CROSS JOIN generate_series(1,6) b;
 IF (SELECT count(*) FROM public.pr298_real_evaluations)<>864
 OR EXISTS(SELECT 1 FROM public.pr298_real_alerts) THEN
  RAISE EXCEPTION 'program-only bootstrap created false alerts or wrong call count';
 END IF;
 RAISE NOTICE 'REAL_EVALUATOR_144_RACES_864_INSERT_CALLS_MS=%',
  round(extract(epoch FROM clock_timestamp()-started)*1000,1);
 -- Fully populated exhibition for one race: boat 1 best in both fields.
 UPDATE public.pr298_real_entries
 SET exhibition_time=CASE WHEN boat_no=1 THEN 6.5 ELSE 6.7 END,
     lap_time=CASE WHEN boat_no=1 THEN 36.0 ELSE 36.5 END
 WHERE race_date=d AND course_code=1 AND race_no=1;
 IF (SELECT count(*) FROM public.pr298_real_alerts)<>1
 OR (SELECT recommended_second_boat FROM public.pr298_real_alerts
     WHERE course_code=1 AND race_no=1)<>2 THEN
  RAISE EXCEPTION 'real evaluator failed to create exactly one qualified alert';
 END IF;
 SELECT count(*) INTO calls FROM public.pr298_real_evaluations;
 UPDATE public.pr298_real_entries SET exhibition_time=exhibition_time
 WHERE race_date=d AND course_code=1 AND race_no=1;
 IF (SELECT count(*) FROM public.pr298_real_alerts)<>1
 OR (SELECT count(*) FROM public.pr298_real_evaluations)<>calls+6 THEN
  RAISE EXCEPTION 'monitored replay failed uniqueness/call-count checks';
 END IF;
 INSERT INTO public.pr298_real_entries(race_date,course_code,race_no,boat_no)
 SELECT d,c,r,b FROM generate_series(1,12) c
 CROSS JOIN generate_series(1,12) r CROSS JOIN generate_series(1,6) b
 ON CONFLICT DO NOTHING;
 IF (SELECT count(*) FROM public.pr298_real_evaluations)<>calls+6 THEN
  RAISE EXCEPTION 'conflict-safe replay invoked evaluator';
 END IF;
 RAISE NOTICE 'REAL_EVALUATOR_144_RACES_PASS';
END $$;
