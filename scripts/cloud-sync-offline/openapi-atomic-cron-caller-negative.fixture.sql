-- Synthetic, network-free negative cases for PR298 Cron candidate.
-- Requires the CI-only noon-JST candidate and runtime fixture HTTP mock.
-- Every malformed payload must fail BEFORE invoking the atomic RPC.
CREATE TEMP TABLE pr298_atomic_calls (n integer NOT NULL);
INSERT INTO pr298_atomic_calls VALUES (0);
CREATE OR REPLACE FUNCTION public.bs_apply_openapi_atomic_candidate(
 p_date date,p_events jsonb,p_entries jsonb,p_preview_entries jsonb,
 p_preview_events jsonb,p_results jsonb,p_result_entries jsonb,
 p_synced_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
 UPDATE pg_temp.pr298_atomic_calls SET n=n+1;
 RETURN jsonb_build_object('ok',true);
END $$;
-- The HTTP mock reads a session-local document; no real network is possible.
CREATE TEMP TABLE pr298_document (doc jsonb NOT NULL);
INSERT INTO pr298_document
SELECT jsonb_build_object('programs',jsonb_build_object('stadiums',
 jsonb_build_object('1',jsonb_build_object('stadium_number',1,'races',
 jsonb_build_object('1',jsonb_build_object(
 'date',(now() AT TIME ZONE 'Asia/Tokyo')::date::text,
 'race_number',1,
 'racers',(SELECT jsonb_object_agg(i::text,jsonb_build_object(
  'entry_number',i,'number',(4000+i)::text)) FROM generate_series(1,6) i)
 ))))));
CREATE OR REPLACE FUNCTION extensions.http_get(url text)
RETURNS extensions.http_response LANGUAGE plpgsql AS $$
DECLARE d jsonb;
BEGIN
 SELECT doc INTO d FROM pg_temp.pr298_document LIMIT 1;
 RETURN ROW(200,'application/json','{}'::jsonb,d::text)::extensions.http_response;
END $$;
DO $$
DECLARE original jsonb; invalid jsonb; response jsonb; calls integer; scenario text;
BEGIN
 SELECT doc INTO original FROM pr298_document;
 FOREACH scenario IN ARRAY ARRAY[
  'valid','missing_boat','non_numeric_registration','duplicate_registration',
  'wrong_date','preview_wrong_boat','result_duplicate_places',
  'preview_racers_array','result_racers_array',
  'boat_scalar','race_scalar','stadium_scalar',
  'payout_without_result_racers'
 ] LOOP
  invalid:=original;
  IF scenario='missing_boat' THEN
   invalid:=invalid #- '{programs,stadiums,1,races,1,racers,6}';
  ELSIF scenario='non_numeric_registration' THEN
   invalid:=jsonb_set(invalid,'{programs,stadiums,1,races,1,racers,1,number}','"40A1"'::jsonb);
  ELSIF scenario='duplicate_registration' THEN
   invalid:=jsonb_set(invalid,'{programs,stadiums,1,races,1,racers,2,number}','"4001"'::jsonb);
  ELSIF scenario='wrong_date' THEN
   invalid:=jsonb_set(invalid,'{programs,stadiums,1,races,1,date}','"1999-01-01"'::jsonb);
  ELSIF scenario='preview_wrong_boat' THEN
   invalid:=jsonb_set(invalid,'{programs,stadiums,1,races,1,preview}',
    '{"racers":{"1":{"entry_number":2}}}'::jsonb);
  ELSIF scenario='result_duplicate_places' THEN
   invalid:=jsonb_set(invalid,'{programs,stadiums,1,races,1,result}',
    '{"racers":{"1":{"entry_number":1,"place_number":1},"2":{"entry_number":2,"place_number":1}}}'::jsonb);
  ELSIF scenario='preview_racers_array' THEN
   invalid:=jsonb_set(invalid,'{programs,stadiums,1,races,1,preview}',
    '{"racers":[{"entry_number":1}]}'::jsonb);
  ELSIF scenario='result_racers_array' THEN
   invalid:=jsonb_set(invalid,'{programs,stadiums,1,races,1,result}',
    '{"racers":[{"entry_number":1,"place_number":1}]}'::jsonb);
  ELSIF scenario='boat_scalar' THEN
   invalid:=jsonb_set(invalid,'{programs,stadiums,1,races,1,racers,1}','42'::jsonb);
  ELSIF scenario='race_scalar' THEN
   invalid:=jsonb_set(invalid,'{programs,stadiums,1,races,1}','42'::jsonb);
  ELSIF scenario='stadium_scalar' THEN
   invalid:=jsonb_set(invalid,'{programs,stadiums,1}','42'::jsonb);
  ELSIF scenario='payout_without_result_racers' THEN
   invalid:=jsonb_set(invalid,'{programs,stadiums,1,races,1,result}',
    '{"payouts":{"trifecta":[{"combination":"1-2-3","amount":1000}]},"racers":{}}'::jsonb);
  END IF;
  UPDATE pr298_document SET doc=invalid;
  UPDATE pr298_atomic_calls SET n=0;
  IF scenario='valid' THEN
   response:=public.bs_sync_openapi_today_atomic_candidate();
   IF response->>'ok' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'valid program rejected: %',response;
   END IF;
  ELSE
   BEGIN
    PERFORM public.bs_sync_openapi_today_atomic_candidate();
    RAISE EXCEPTION 'negative case % was accepted',scenario;
   EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'negative case % was accepted' THEN RAISE; END IF;
   END;
  END IF;
  SELECT n INTO calls FROM pr298_atomic_calls;
  IF calls <> (CASE WHEN scenario='valid' THEN 1 ELSE 0 END) THEN
   RAISE EXCEPTION 'atomic call count mismatch in %: %',scenario,calls;
  END IF;
  RAISE NOTICE 'CRON_NEGATIVE_CASE=% PASS',scenario;
 END LOOP;
END $$;
