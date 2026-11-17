-- Disposable PostgreSQL CI ONLY: document why the legacy bootstrap RPC
-- MUST NOT be exposed as an unrestricted historical repair endpoint.
-- This is a negative capability test: the old RPC accepts incomplete programs.
DO $test$
DECLARE d date:=DATE '2026-11-14'; ev jsonb; en jsonb; response jsonb;
BEGIN
 ev:=jsonb_build_array(jsonb_build_object('race_date',d,'course_code',9,'race_no',12));
 SELECT jsonb_agg(jsonb_build_object('race_date',d,'course_code',9,'race_no',12,
   'boat_no',b,'racer_registration_no',lpad((3000+b)::text,5,'0')))
 INTO en FROM generate_series(1,5) b;
 response:=public.bs_apply_openapi_bootstrap(ev,en,now());
 IF (response->>'event_inserted')::int<>1 OR (response->>'entry_inserted')::int<>5 THEN
   RAISE EXCEPTION 'legacy bootstrap behavior changed; reassess historical safety: %',response;
 END IF;
 IF (SELECT count(*) FROM public.bs_race_entries
   WHERE (race_date,course_code,race_no)=(d,9,12))<>5 THEN
   RAISE EXCEPTION 'expected five-boat legacy behavior not observed';
 END IF;
 RAISE NOTICE 'EXPECTED LEGACY WEAKNESS: bootstrap accepts five-boat race. Historical repair must validate six boats BEFORE calling writer';
END $test$;
