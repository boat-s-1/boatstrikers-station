-- CANDIDATE ONLY. DO NOT INSTALL IN PRODUCTION WITHOUT APPROVAL.
-- Historical *program-only* restore. No preview/result writer calls.
-- Caller must provide verified archived source, explicit target race allowlist,
-- and separate permission for production writes. Security invoker requires a
-- privileged caller; no public/anon/authenticated EXECUTE.
BEGIN;
CREATE OR REPLACE FUNCTION public.bs_apply_openapi_historical_program_candidate(
 p_date date, p_events jsonb, p_entries jsonb, p_synced_at timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='public'
AS $fn$
DECLARE
 v_events integer;
 v_entries integer;
 v_written jsonb;
BEGIN
 IF p_date IS NULL OR p_date >= (now() AT TIME ZONE 'Asia/Tokyo')::date
   OR p_date < DATE '2026-11-13' OR p_date > DATE '2026-11-17' THEN
   RAISE EXCEPTION 'historical repair date outside approved candidate window';
 END IF;
 IF p_synced_at IS NULL OR p_synced_at > now() + interval '5 minutes' THEN
   RAISE EXCEPTION 'invalid historical source capture timestamp';
 END IF;
 IF jsonb_typeof(p_events) IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_entries) IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'historical program arrays required';
 END IF;
 v_events:=jsonb_array_length(p_events);
 v_entries:=jsonb_array_length(p_entries);
 IF v_events<1 OR v_events>288 OR v_entries<>6*v_events THEN
   RAISE EXCEPTION 'historical program incomplete: events %, entries %',v_events,v_entries;
 END IF;
 IF EXISTS (
   WITH ev AS (
    SELECT x.race_date,x.course_code,x.race_no
    FROM jsonb_to_recordset(p_events) x(race_date date,course_code int,race_no int)
   ), en AS (
    SELECT x.race_date,x.course_code,x.race_no,x.boat_no,x.racer_registration_no
    FROM jsonb_to_recordset(p_entries) x(
      race_date date,course_code int,race_no int,boat_no int,racer_registration_no text)
   )
   SELECT 1 WHERE
    EXISTS(SELECT 1 FROM ev WHERE race_date IS DISTINCT FROM p_date
      OR course_code IS NULL OR course_code NOT BETWEEN 1 AND 24
      OR race_no IS NULL OR race_no NOT BETWEEN 1 AND 12)
    OR EXISTS(SELECT 1 FROM ev GROUP BY race_date,course_code,race_no HAVING count(*)<>1)
    OR EXISTS(SELECT 1 FROM en WHERE race_date IS DISTINCT FROM p_date
      OR course_code IS NULL OR course_code NOT BETWEEN 1 AND 24
      OR race_no IS NULL OR race_no NOT BETWEEN 1 AND 12
      OR boat_no IS NULL OR boat_no NOT BETWEEN 1 AND 6
      OR racer_registration_no IS NULL
      OR racer_registration_no !~ '^(0[0-9]{4}|[0-9]{4})$'
      OR racer_registration_no IN ('0000','00000'))
    OR EXISTS(SELECT 1 FROM en GROUP BY race_date,course_code,race_no,boat_no HAVING count(*)<>1)
    OR EXISTS(SELECT 1 FROM en GROUP BY race_date,course_code,race_no,racer_registration_no HAVING count(*)<>1)
    OR EXISTS(SELECT 1 FROM en e WHERE NOT EXISTS(
      SELECT 1 FROM ev v WHERE (v.race_date,v.course_code,v.race_no)=
        (e.race_date,e.course_code,e.race_no)))
    OR EXISTS(SELECT 1 FROM ev v WHERE
      (SELECT count(*) FROM en e WHERE (e.race_date,e.course_code,e.race_no)=
        (v.race_date,v.course_code,v.race_no))<>6)
 ) THEN
   RAISE EXCEPTION 'invalid historical program keys or boat identities';
 END IF;
 -- Require every requested race to have an existing settled result. This
 -- prevents the repair endpoint from creating arbitrary historical programs.
 IF EXISTS (
   SELECT 1 FROM jsonb_to_recordset(p_events)
     AS requested(race_date date,course_code int,race_no int)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.bs_race_results r
     WHERE (r.race_date,r.course_code,r.race_no)=
       (requested.race_date,requested.course_code,requested.race_no)
   )
 ) THEN
   RAISE EXCEPTION 'historical repair requires existing result for every race';
 END IF;
 IF NOT pg_try_advisory_xact_lock(299,(p_date-DATE '2000-01-01')::integer) THEN
   RAISE EXCEPTION 'historical program repair already running';
 END IF;
 v_written:=public.bs_apply_openapi_bootstrap(p_events,p_entries,p_synced_at);
 IF EXISTS (
   WITH ev AS (
    SELECT x.race_date,x.course_code,x.race_no
    FROM jsonb_to_recordset(p_events) x(race_date date,course_code int,race_no int)
   ), en AS (
    SELECT x.race_date,x.course_code,x.race_no,x.boat_no,x.racer_registration_no
    FROM jsonb_to_recordset(p_entries) x(
      race_date date,course_code int,race_no int,boat_no int,racer_registration_no text)
   )
   SELECT 1 FROM ev want WHERE
      (SELECT count(*) FROM public.bs_race_entries actual WHERE
        (actual.race_date,actual.course_code,actual.race_no)=
        (want.race_date,want.course_code,want.race_no)) <> 6
   UNION ALL
   SELECT 1 FROM en want WHERE NOT EXISTS (
    SELECT 1 FROM public.bs_race_entries actual WHERE
      (actual.race_date,actual.course_code,actual.race_no,actual.boat_no,actual.racer_registration_no)=
      (want.race_date,want.course_code,want.race_no,want.boat_no,want.racer_registration_no))
   UNION ALL
   SELECT 1 FROM ev want WHERE NOT EXISTS (
    SELECT 1 FROM public.bs_race_events actual WHERE
      (actual.race_date,actual.course_code,actual.race_no)=
      (want.race_date,want.course_code,want.race_no))
 ) THEN
   RAISE EXCEPTION 'historical persisted program mismatch: rollback';
 END IF;
 RETURN jsonb_build_object('date',p_date,'event_count',v_events,
   'entry_count',v_entries,'bootstrap',v_written);
END
$fn$;
REVOKE ALL ON FUNCTION public.bs_apply_openapi_historical_program_candidate(
 date,jsonb,jsonb,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bs_apply_openapi_historical_program_candidate(
 date,jsonb,jsonb,timestamptz) TO service_role;
COMMIT;
