-- PR #298 DRAFT ONLY: database-side Cron caller for atomic ingest.
-- DO NOT INSTALL IN PRODUCTION OR REPOINT CRON WITHOUT EXPLICIT APPROVAL.
-- Fetches exactly once and invokes exactly one atomic transaction.
-- WARNING: extensions.http_get privilege and production trigger fan-out are unverified.
BEGIN;
CREATE OR REPLACE FUNCTION public.bs_sync_openapi_today_atomic_candidate()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path='public','extensions'
AS $fn$
DECLARE
 v_date date := (now() AT TIME ZONE 'Asia/Tokyo')::date;
 v_clock time := (now() AT TIME ZONE 'Asia/Tokyo')::time;
 v_response extensions.http_response;
 v_document jsonb;
 v_events jsonb;
 v_entries jsonb;
 v_preview_events jsonb;
 v_preview_entries jsonb;
 v_results jsonb;
 v_result_entries jsonb;
BEGIN
 IF v_clock < time '07:00' OR v_clock > time '23:30' THEN
  RETURN jsonb_build_object('ok',true,'skipped',true,'reason','outside_jst_window');
 END IF;
 v_response := extensions.http_get('https://boatraceopenapi.github.io/api/v1/today.json');
 IF v_response.status <> 200 THEN
  RAISE EXCEPTION 'OpenAPI HTTP status %',v_response.status;
 END IF;
 v_document := v_response.content::jsonb;
 IF jsonb_typeof(v_document #> '{programs,stadiums}') IS DISTINCT FROM 'object' THEN
  RAISE EXCEPTION 'OpenAPI stadium collection invalid';
 END IF;
 -- Reject malformed schedule keys, duplicate racer IDs, incomplete races and
 -- mismatched dates before applying any write.
 IF EXISTS (
  WITH stadium AS (
   SELECT s.key AS sk,s.value AS sv
   FROM jsonb_each(v_document #> '{programs,stadiums}') s
  ), race AS (
   SELECT sk,sv,r.key AS rk,r.value AS rv
   FROM stadium CROSS JOIN LATERAL
    jsonb_each(CASE WHEN jsonb_typeof(sv->'races')='object'
      THEN sv->'races' ELSE '{}'::jsonb END) r
  ), boats AS (
   SELECT sk,rk,rv,b.key AS bk,b.value AS bv
   FROM race CROSS JOIN LATERAL
    jsonb_each(CASE WHEN jsonb_typeof(rv->'racers')='object'
      THEN rv->'racers' ELSE '{}'::jsonb END) b
  )
  SELECT 1 WHERE
   (SELECT count(*)=0 FROM race)
   OR EXISTS(SELECT 1 FROM stadium WHERE sk !~ '^(?:[1-9]|1[0-9]|2[0-4])$'
      OR jsonb_typeof(sv->'races') IS DISTINCT FROM 'object')
   OR EXISTS(SELECT 1 FROM race WHERE rk !~ '^(?:[1-9]|1[0-2])$'
      OR rv->>'stadium_number' IS DISTINCT FROM sk
      OR rv->>'race_number' IS DISTINCT FROM rk
      OR rv->>'date' IS DISTINCT FROM v_date::text
      OR jsonb_typeof(rv->'racers') IS DISTINCT FROM 'object'
      OR (SELECT count(*) FROM jsonb_each(CASE WHEN jsonb_typeof(rv->'racers')='object' THEN rv->'racers' ELSE '{}'::jsonb END)) <> 6)
   OR EXISTS(SELECT 1 FROM boats WHERE bk NOT IN ('1','2','3','4','5','6')
      OR bv->>'entry_number' IS DISTINCT FROM bk
      OR bv->>'number' IS NULL
      OR length(bv->>'number') NOT IN (4,5)
      OR translate(bv->>'number','0123456789','') <> ''
      OR (length(bv->>'number')=5 AND left(bv->>'number',1)<>'0')
      OR bv->>'number' IN ('0000','00000'))
   OR EXISTS(SELECT 1 FROM boats WHERE jsonb_typeof(bv) IS DISTINCT FROM 'object')
   OR EXISTS(SELECT 1 FROM race WHERE jsonb_typeof(rv) IS DISTINCT FROM 'object')
   OR EXISTS(SELECT 1 FROM stadium WHERE jsonb_typeof(sv) IS DISTINCT FROM 'object')
   OR EXISTS(SELECT 1 FROM boats GROUP BY sk,rk,bv->>'number' HAVING count(*)>1)
   OR EXISTS(SELECT 1 FROM race r CROSS JOIN LATERAL jsonb_each(
      CASE WHEN jsonb_typeof(r.rv #> '{result,racers}')='object'
       THEN r.rv #> '{result,racers}' ELSE '{}'::jsonb END) p
      WHERE p.value->>'place_number' IN ('1','2','3','4','5','6')
      GROUP BY r.sk,r.rk,p.value->>'place_number' HAVING count(*)>1)
   OR EXISTS(SELECT 1 FROM boats WHERE bv->>'weight' IS NOT NULL
      AND bv->>'weight' !~ '^[0-9]+([.][0-9]+)?$')
   -- Validate all four mapped payout types before calling the atomic writer.
   OR EXISTS(SELECT 1 FROM race r CROSS JOIN LATERAL
      (VALUES ('trifecta'),('exacta'),('quinella'),('trio')) kinds(kind)
      WHERE r.rv #>> ARRAY['result','payouts',kinds.kind,'0','amount'] IS NOT NULL
        AND r.rv #>> ARRAY['result','payouts',kinds.kind,'0','amount'] !~ '^[0-9]+$')
   OR EXISTS(SELECT 1 FROM race WHERE rv->'preview' IS NOT NULL
      AND jsonb_typeof(rv->'preview') NOT IN ('object','null'))
   OR EXISTS(SELECT 1 FROM race WHERE rv->'result' IS NOT NULL
      AND jsonb_typeof(rv->'result') NOT IN ('object','null'))
   -- Match the JS atomic result parser: a payout alone cannot settle a
   -- race without boat-level result details.
   OR EXISTS(SELECT 1 FROM race WHERE
      rv #>> '{result,payouts,trifecta,0,combination}' IS NOT NULL
      AND (jsonb_typeof(rv #> '{result,racers}') IS DISTINCT FROM 'object'
        OR rv #> '{result,racers}' = '{}'::jsonb))
   OR EXISTS(SELECT 1 FROM race WHERE jsonb_typeof(rv->'preview')='object'
      AND rv #> '{preview,racers}' IS NOT NULL
      AND jsonb_typeof(rv #> '{preview,racers}') NOT IN ('object','null'))
   OR EXISTS(SELECT 1 FROM race WHERE jsonb_typeof(rv->'result')='object'
      AND rv #> '{result,racers}' IS NOT NULL
      AND jsonb_typeof(rv #> '{result,racers}') NOT IN ('object','null'))
   -- Optional preview/result identity fields must agree with the parent race.
   OR EXISTS(SELECT 1 FROM race WHERE jsonb_typeof(rv->'preview')='object'
      AND ((rv #>> '{preview,stadium_number}' IS NOT NULL
         AND rv #>> '{preview,stadium_number}' IS DISTINCT FROM sk)
        OR (rv #>> '{preview,race_number}' IS NOT NULL
         AND rv #>> '{preview,race_number}' IS DISTINCT FROM rk)))
   OR EXISTS(SELECT 1 FROM race WHERE jsonb_typeof(rv->'result')='object'
      AND ((rv #>> '{result,date}' IS NOT NULL
         AND rv #>> '{result,date}' IS DISTINCT FROM v_date::text)
        OR (rv #>> '{result,stadium_number}' IS NOT NULL
         AND rv #>> '{result,stadium_number}' IS DISTINCT FROM sk)
        OR (rv #>> '{result,race_number}' IS NOT NULL
         AND rv #>> '{result,race_number}' IS DISTINCT FROM rk)))
   OR EXISTS(SELECT 1 FROM race WHERE jsonb_typeof(rv->'preview')='object'
      AND rv #>> '{preview,date}' IS NOT NULL
      AND rv #>> '{preview,date}' IS DISTINCT FROM v_date::text)
   OR EXISTS(SELECT 1 FROM race r CROSS JOIN LATERAL jsonb_each(
      CASE WHEN jsonb_typeof(r.rv #> '{preview,racers}')='object'
       THEN r.rv #> '{preview,racers}' ELSE '{}'::jsonb END) p
      WHERE jsonb_typeof(p.value) IS DISTINCT FROM 'object')
   OR EXISTS(SELECT 1 FROM race r CROSS JOIN LATERAL jsonb_each(
      CASE WHEN jsonb_typeof(r.rv #> '{result,racers}')='object'
       THEN r.rv #> '{result,racers}' ELSE '{}'::jsonb END) p
      WHERE jsonb_typeof(p.value) IS DISTINCT FROM 'object')
   OR EXISTS(SELECT 1 FROM race r CROSS JOIN LATERAL jsonb_each(
      CASE WHEN jsonb_typeof(r.rv #> '{preview,racers}')='object'
       THEN r.rv #> '{preview,racers}' ELSE '{}'::jsonb END) p
      WHERE p.key NOT IN ('1','2','3','4','5','6')
         OR p.value->>'entry_number' IS DISTINCT FROM p.key)
   OR EXISTS(SELECT 1 FROM race r CROSS JOIN LATERAL jsonb_each(
      CASE WHEN jsonb_typeof(r.rv #> '{result,racers}')='object'
       THEN r.rv #> '{result,racers}' ELSE '{}'::jsonb END) p
      WHERE p.key NOT IN ('1','2','3','4','5','6')
         OR p.value->>'entry_number' IS DISTINCT FROM p.key)
 ) THEN RAISE EXCEPTION 'invalid official OpenAPI program'; END IF;
 -- Shared flattened CTE ensures all six payloads use the same snapshot.
 WITH stadium AS (
  SELECT s.key::integer AS course_code,s.value AS sv
  FROM jsonb_each(v_document #> '{programs,stadiums}') s
 ), race AS (
  SELECT course_code,r.key::integer AS race_no,r.value AS rv
  FROM stadium CROSS JOIN LATERAL jsonb_each(sv->'races') r
 ), boat AS (
  SELECT course_code,race_no,rv,b.key::integer AS boat_no,b.value AS bv
  FROM race CROSS JOIN LATERAL jsonb_each(rv->'racers') b
 ), preview AS (
  SELECT course_code,race_no,rv,rv->'preview' AS pv FROM race
  WHERE jsonb_typeof(rv->'preview')='object'
 ), preview_boat AS (
  SELECT course_code,race_no,pv,b.key::integer AS boat_no,b.value AS bv
  FROM preview CROSS JOIN LATERAL jsonb_each(
   CASE WHEN jsonb_typeof(pv->'racers')='object' THEN pv->'racers'
    ELSE '{}'::jsonb END) b
 ), settled AS (
  SELECT course_code,race_no,rv->'result' AS res FROM race
  WHERE jsonb_typeof(rv->'result')='object'
    AND (rv #>> '{result,payouts,trifecta,0,combination}' IS NOT NULL
     OR EXISTS(SELECT 1 FROM jsonb_each(
      CASE WHEN jsonb_typeof(rv #> '{result,racers}')='object'
       THEN rv #> '{result,racers}' ELSE '{}'::jsonb END) x
      WHERE x.value->>'place_number' ~ '^[1-6]$'))
 ), result_boat AS (
  SELECT course_code,race_no,res,b.key::integer AS boat_no,b.value AS bv
  FROM settled CROSS JOIN LATERAL jsonb_each(
   CASE WHEN jsonb_typeof(res->'racers')='object'
    THEN res->'racers' ELSE '{}'::jsonb END) b
 )
 SELECT
  (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'race_date',v_date,'course_code',course_code,'race_no',race_no,
    'course_name',(ARRAY['桐生','戸田','江戸川','平和島','多摩川','浜名湖','蒲郡','常滑','津','三国','びわこ','住之江','尼崎','鳴門','丸亀','児島','宮島','徳山','下関','若松','芦屋','福岡','唐津','大村'])[course_code],
    'race_name',nullif(coalesce(rv->>'subtitle',rv->>'title'), ''),
    'closing_time',substring(rv->>'closed_at' from '[0-9]{2}:[0-9]{2}(:[0-9]{2})?'),
    'distance',nullif(rv->>'distance','')::numeric,
    'race_day_no',nullif(rv->>'day_number','')::integer
  )), '[]'::jsonb) FROM race),
  (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'race_date',v_date,'course_code',course_code,'race_no',race_no,'boat_no',boat_no,
    'racer_registration_no',bv->>'number','racer_name',bv->>'name',
    'racer_class',bv->>'rank_number_source',
    'national_win_rate',nullif(bv->>'national_win_rate','')::numeric,
    'local_win_rate',nullif(bv->>'local_win_rate','')::numeric,
    'national_2_rate',nullif(bv->>'national_top_2_percent','')::numeric,
    'local_2_rate',nullif(bv->>'local_top_2_percent','')::numeric,
    'flying_count',nullif(bv->>'flying_count','')::integer,
    'late_count',nullif(bv->>'late_count','')::integer,
    'motor_2_rate',nullif(bv->>'motor_top_2_percent','')::numeric,
    'boat_2_rate',nullif(bv->>'boat_top_2_percent','')::numeric,
    'racer_weight',nullif(bv->>'weight','')::numeric,
    'average_st',nullif(bv->>'average_start_timing','')::numeric,
    'motor_no',nullif(bv->>'motor_number','')::integer,
    'boat_machine_no',nullif(bv->>'boat_number','')::integer
  )), '[]'::jsonb) FROM boat),
  (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'race_date',v_date,'course_code',course_code,'race_no',race_no,
    'wind_speed',nullif(pv->>'wind_speed','')::numeric,
    'wind_direction_code',pv->>'wind_direction_number',
    'wave_height',nullif(pv->>'wave_height','')::numeric,
    'weather_code',pv->>'weather_number',
    'air_temperature',nullif(pv->>'air_temperature','')::numeric,
    'water_temperature',nullif(pv->>'water_temperature','')::numeric
  )), '[]'::jsonb) FROM preview),
  (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'race_date',v_date,'course_code',course_code,'race_no',race_no,'boat_no',boat_no,
    'exhibition_time',nullif(bv->>'exhibition_time','')::numeric,
    'exhibition_st',nullif(bv->>'start_timing','')::numeric,
    'exhibition_course',nullif(bv->>'course_number','')::integer,
    'tilt',nullif(bv->>'tilt_adjustment','')::numeric
  )), '[]'::jsonb) FROM preview_boat
   WHERE bv->>'exhibition_time' IS NOT NULL OR bv->>'start_timing' IS NOT NULL
     OR bv->>'course_number' IS NOT NULL OR bv->>'tilt_adjustment' IS NOT NULL),
  (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'race_date',v_date,'course_code',course_code,'race_no',race_no,
    'winning_method',res->>'technique_number_source',
    'technique_code',res->>'technique_number',
    'trifecta_result',res #>> '{payouts,trifecta,0,combination}',
    'trifecta_payout',res #>> '{payouts,trifecta,0,amount}',
    'exacta',res #>> '{payouts,exacta,0,combination}',
    'exacta_payout',res #>> '{payouts,exacta,0,amount}',
    'quinella',res #>> '{payouts,quinella,0,combination}',
    'quinella_payout',res #>> '{payouts,quinella,0,amount}',
    'trio',res #>> '{payouts,trio,0,combination}',
    'trio_payout',res #>> '{payouts,trio,0,amount}',
    'first_boat',(SELECT (x.value->>'entry_number')::integer
      FROM jsonb_each(coalesce(res->'racers','{}'::jsonb)) x
      WHERE x.value->>'place_number'='1' LIMIT 1),
    'second_boat',(SELECT (x.value->>'entry_number')::integer
      FROM jsonb_each(coalesce(res->'racers','{}'::jsonb)) x
      WHERE x.value->>'place_number'='2' LIMIT 1),
    'third_boat',(SELECT (x.value->>'entry_number')::integer
      FROM jsonb_each(coalesce(res->'racers','{}'::jsonb)) x
      WHERE x.value->>'place_number'='3' LIMIT 1)
  )), '[]'::jsonb) FROM settled),
  (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'race_date',v_date,'course_code',course_code,'race_no',race_no,'boat_no',boat_no,
    'arrival_order',CASE WHEN bv->>'place_number' ~ '^[1-6]$'
      THEN (bv->>'place_number')::integer ELSE NULL END,
    'finish_place',bv->>'place_number_source',
    'actual_course',nullif(bv->>'course_number','')::integer,
    'actual_st',nullif(bv->>'start_timing','')::numeric,
    'result_note',res->>'remarks'
  )), '[]'::jsonb) FROM result_boat)
 INTO v_events,v_entries,v_preview_events,v_preview_entries,v_results,v_result_entries;
 RETURN public.bs_apply_openapi_atomic_candidate(
  v_date,v_events,v_entries,v_preview_entries,v_preview_events,
  v_results,v_result_entries,now());
END
$fn$;
REVOKE ALL ON FUNCTION public.bs_sync_openapi_today_atomic_candidate()
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bs_sync_openapi_today_atomic_candidate()
 TO service_role;
COMMIT;
-- HOLD: not authorized for production installation or Cron cutover.
