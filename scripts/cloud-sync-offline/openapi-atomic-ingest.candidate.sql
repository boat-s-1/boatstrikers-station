-- CANDIDATE ONLY. DO NOT INSTALL ON PRODUCTION WITHOUT APPROVAL.
-- Wrap CREATE/REVOKE/GRANT in one transaction: no transient PUBLIC EXECUTE.
-- Single RPC = one PostgreSQL transaction for bootstrap, preview, results.
-- Input comes from independently validated OpenAPI payload, not direct client input.
BEGIN;
CREATE OR REPLACE FUNCTION public.bs_apply_openapi_atomic_candidate(
 p_date date,p_events jsonb,p_entries jsonb,p_preview_entries jsonb,
 p_preview_events jsonb,p_results jsonb,p_result_entries jsonb,
 p_synced_at timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='public'
AS $fn$
DECLARE
 v_events integer;
 v_entries integer;
 v_bootstrap jsonb;
 v_preview_entries jsonb;
 v_preview_events jsonb;
 v_results jsonb;
BEGIN
 IF p_date IS NULL OR p_date <> (now() AT TIME ZONE 'Asia/Tokyo')::date THEN
   RAISE EXCEPTION 'atomic OpenAPI bootstrap is current JST date only';
 END IF;
 IF p_synced_at IS NULL OR p_synced_at > now() + interval '5 minutes'
    OR p_synced_at < now() - interval '15 minutes' THEN
   RAISE EXCEPTION 'invalid OpenAPI capture timestamp';
 END IF;
 IF jsonb_typeof(p_events) IS DISTINCT FROM 'array'
 OR jsonb_typeof(p_entries) IS DISTINCT FROM 'array'
 OR jsonb_typeof(p_preview_entries) IS DISTINCT FROM 'array'
 OR jsonb_typeof(p_preview_events) IS DISTINCT FROM 'array'
 OR jsonb_typeof(p_results) IS DISTINCT FROM 'array'
 OR jsonb_typeof(p_result_entries) IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'OpenAPI payload arrays required';
 END IF;
 v_events:=jsonb_array_length(p_events);
 v_entries:=jsonb_array_length(p_entries);
 IF v_events=0 OR v_events>288 OR v_entries<>6*v_events THEN
   RAISE EXCEPTION 'OpenAPI program count invalid: events %, entries %',v_events,v_entries;
 END IF;
 -- Strict key and boat identity validation before any write.
 IF EXISTS (
   WITH ev AS (
     SELECT x.race_date,x.course_code,x.race_no
     FROM jsonb_to_recordset(p_events) AS x(race_date date,course_code int,race_no int)
   ), en AS (
     SELECT x.race_date,x.course_code,x.race_no,x.boat_no,x.racer_registration_no
     FROM jsonb_to_recordset(p_entries) AS x(
       race_date date,course_code int,race_no int,boat_no int,racer_registration_no text)
   )
   SELECT 1 WHERE
      EXISTS(SELECT 1 FROM ev WHERE race_date IS DISTINCT FROM p_date
         OR course_code NOT BETWEEN 1 AND 24 OR race_no NOT BETWEEN 1 AND 12
         OR course_code IS NULL OR race_no IS NULL)
   OR EXISTS(SELECT 1 FROM ev GROUP BY race_date,course_code,race_no HAVING count(*)<>1)
   OR EXISTS(SELECT 1 FROM en WHERE race_date IS DISTINCT FROM p_date
         OR course_code NOT BETWEEN 1 AND 24 OR race_no NOT BETWEEN 1 AND 12
         OR boat_no NOT BETWEEN 1 AND 6 OR boat_no IS NULL
         OR racer_registration_no IS NULL OR racer_registration_no !~ '^(0[0-9]{4}|[0-9]{4})$' OR racer_registration_no IN ('0000','00000'))
   OR EXISTS(SELECT 1 FROM en GROUP BY race_date,course_code,race_no,boat_no HAVING count(*)<>1)
   OR EXISTS(SELECT 1 FROM en GROUP BY race_date,course_code,race_no,racer_registration_no HAVING count(*)<>1)
   OR EXISTS(SELECT 1 FROM en e WHERE NOT EXISTS(
         SELECT 1 FROM ev v WHERE v.race_date=e.race_date
         AND v.course_code=e.course_code AND v.race_no=e.race_no))
   OR EXISTS(SELECT 1 FROM ev v WHERE
       (SELECT count(*) FROM en e WHERE e.race_date=v.race_date
         AND e.course_code=v.course_code AND e.race_no=v.race_no)<>6)
 ) THEN
   RAISE EXCEPTION 'invalid OpenAPI program keys/boat identities';
 END IF;
 -- Every dependent payload key must belong to the validated program.
 -- Reject duplicate race or boat keys, wrong dates and out-of-range boat numbers.
 IF EXISTS (
   WITH ev AS (
     SELECT x.race_date,x.course_code,x.race_no
     FROM jsonb_to_recordset(p_events) AS x(race_date date,course_code int,race_no int)
   ), en AS (
     SELECT x.race_date,x.course_code,x.race_no,x.boat_no
     FROM jsonb_to_recordset(p_entries) AS x(race_date date,course_code int,race_no int,boat_no int)
   ), dependent AS (
     SELECT 'preview_event' AS kind,x.race_date,x.course_code,x.race_no,NULL::int AS boat_no
     FROM jsonb_to_recordset(p_preview_events) AS x(race_date date,course_code int,race_no int)
     UNION ALL
     SELECT 'result',x.race_date,x.course_code,x.race_no,NULL::int
     FROM jsonb_to_recordset(p_results) AS x(race_date date,course_code int,race_no int)
     UNION ALL
     SELECT 'preview_entry',x.race_date,x.course_code,x.race_no,x.boat_no
     FROM jsonb_to_recordset(p_preview_entries) AS x(race_date date,course_code int,race_no int,boat_no int)
     UNION ALL
     SELECT 'result_entry',x.race_date,x.course_code,x.race_no,x.boat_no
     FROM jsonb_to_recordset(p_result_entries) AS x(race_date date,course_code int,race_no int,boat_no int)
   )
   SELECT 1 WHERE
      EXISTS (SELECT 1 FROM dependent x WHERE x.race_date IS DISTINCT FROM p_date
        OR x.course_code IS NULL OR x.race_no IS NULL
        OR NOT EXISTS (SELECT 1 FROM ev v WHERE v.race_date=x.race_date
          AND v.course_code=x.course_code AND v.race_no=x.race_no)
        OR (x.kind IN ('preview_entry','result_entry') AND (
          x.boat_no IS NULL OR NOT EXISTS (
            SELECT 1 FROM en e WHERE e.race_date=x.race_date
              AND e.course_code=x.course_code AND e.race_no=x.race_no
              AND e.boat_no=x.boat_no))))
   OR EXISTS (SELECT 1 FROM dependent
      GROUP BY kind,race_date,course_code,race_no,boat_no HAVING count(*)>1)
 ) THEN
   RAISE EXCEPTION 'invalid OpenAPI dependent payload race/boat keys';
 END IF;
 -- Same-date writers serialize; use try-lock to avoid piling up Cron calls.
 IF NOT pg_try_advisory_xact_lock(298, (p_date - DATE '2000-01-01')::integer) THEN
   RAISE EXCEPTION 'OpenAPI atomic ingestion already running for %',p_date;
 END IF;
 v_bootstrap:=public.bs_apply_openapi_bootstrap(p_events,p_entries,p_synced_at);
 v_preview_entries:=public.bs_apply_openapi_preview(p_preview_entries,p_synced_at);
 v_preview_events:=public.bs_apply_openapi_preview_events(p_preview_events,p_synced_at);
 v_results:=public.bs_apply_openapi_results(p_results,p_result_entries,p_synced_at);
 -- The old Cron reported success with no persisted events/entries.
 -- Verify the database state, not just writer return counts.
 IF EXISTS (
   WITH expected AS (
     SELECT x.race_date,x.course_code,x.race_no
     FROM jsonb_to_recordset(p_events)
       AS x(race_date date,course_code int,race_no int)
   )
   SELECT 1 FROM expected x
   WHERE NOT EXISTS (
     SELECT 1 FROM public.bs_race_events e
     WHERE e.race_date=x.race_date AND e.course_code=x.course_code
       AND e.race_no=x.race_no)
   OR (SELECT count(*) FROM public.bs_race_entries en
       WHERE en.race_date=x.race_date AND en.course_code=x.course_code
         AND en.race_no=x.race_no) <> 6
   OR EXISTS (
     SELECT 1 FROM jsonb_to_recordset(p_entries)
       AS want(race_date date,course_code int,race_no int,boat_no int,racer_registration_no text)
     WHERE want.race_date=x.race_date AND want.course_code=x.course_code
       AND want.race_no=x.race_no
       AND NOT EXISTS (
         SELECT 1 FROM public.bs_race_entries actual
         WHERE actual.race_date=want.race_date
           AND actual.course_code=want.course_code
           AND actual.race_no=want.race_no
           AND actual.boat_no=want.boat_no
           AND actual.racer_registration_no=want.racer_registration_no))
 ) THEN
   RAISE EXCEPTION 'OpenAPI persisted program incomplete: transaction rolled back';
 END IF;
 RETURN jsonb_build_object('date',p_date,'event_count',v_events,'entry_count',v_entries,
   'bootstrap',v_bootstrap,'preview_entries',v_preview_entries,
   'preview_events',v_preview_events,'results',v_results);
END
$fn$;
REVOKE ALL ON FUNCTION public.bs_apply_openapi_atomic_candidate(
 date,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bs_apply_openapi_atomic_candidate(
 date,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,timestamptz) TO service_role;
COMMIT;
-- Still gated: production source priorities, trigger fan-out, official schedule
-- parity, same-transaction rollback and live caller integration are unverified.
