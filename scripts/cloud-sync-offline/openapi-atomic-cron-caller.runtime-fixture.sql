-- Disposable PostgreSQL 17 integration fixture. No external network or production writes.
-- Execute AFTER openapi-atomic-cron-caller.candidate.sql.
CREATE OR REPLACE FUNCTION public.bs_apply_openapi_atomic_candidate(
 p_date date,p_events jsonb,p_entries jsonb,p_preview_entries jsonb,
 p_preview_events jsonb,p_results jsonb,p_result_entries jsonb,
 p_synced_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
 IF p_date <> (now() AT TIME ZONE 'Asia/Tokyo')::date
 OR jsonb_array_length(p_events) <> 1
 OR jsonb_array_length(p_entries) <> 6
 OR jsonb_array_length(p_preview_entries) <> 1
 OR jsonb_array_length(p_preview_events) <> 1
 OR jsonb_array_length(p_results) <> 0
 OR jsonb_array_length(p_result_entries) <> 0
 THEN RAISE EXCEPTION 'unexpected atomic payload cardinality'; END IF;
 IF p_events->0->>'course_name' <> '桐生'
 OR p_entries->0->>'national_2_rate' IS NULL
 OR p_entries->0->>'racer_weight' IS NULL
 THEN RAISE EXCEPTION 'bootstrap mapper field parity missing'; END IF;
 RETURN jsonb_build_object('ok',true,'fixture',true);
END $$;
CREATE OR REPLACE FUNCTION extensions.http_get(url text)
RETURNS extensions.http_response LANGUAGE sql AS $$
 SELECT ROW(200,'application/json','{}'::jsonb,
 jsonb_build_object('programs',jsonb_build_object('stadiums',
  jsonb_build_object('1',jsonb_build_object('races',
   jsonb_build_object('1',jsonb_build_object(
    'date',(now() AT TIME ZONE 'Asia/Tokyo')::date::text,
    'stadium_number',1,'race_number',1,'subtitle','fixture',
    'racers',(SELECT jsonb_object_agg(i::text,
      jsonb_build_object('entry_number',i,'number',(4000+i)::text,
       'name','Fixture','national_top_2_percent',40,
       'weight',52))
     FROM generate_series(1,6) i),
    'preview',jsonb_build_object('date',(now() AT TIME ZONE 'Asia/Tokyo')::date::text,
     'wind_speed',2,'racers',jsonb_build_object('1',
       jsonb_build_object('entry_number',1,'exhibition_time',6.8)))
   ))))))::text)::extensions.http_response
$$;
-- Time-window guard is deliberately NOT bypassed. A fixture run outside the
-- 07:00-23:30 JST window must skip without HTTP or atomic write.
DO $$
DECLARE response jsonb;
BEGIN
 response:=public.bs_sync_openapi_today_atomic_candidate();
 IF (now() AT TIME ZONE 'Asia/Tokyo')::time BETWEEN time '07:00' AND time '23:30' THEN
  RAISE NOTICE 'CRON_FIXTURE_BRANCH=ACTIVE_PAYLOAD_VALIDATED';
  IF response->>'fixture' IS DISTINCT FROM 'true' THEN
   RAISE EXCEPTION 'runtime candidate failed: %',response; END IF;
 ELSE
  RAISE NOTICE 'CRON_FIXTURE_BRANCH=TIME_WINDOW_SKIP_ONLY';
  IF response->>'skipped' IS DISTINCT FROM 'true' THEN
   RAISE EXCEPTION 'out-of-window guard failed: %',response; END IF;
 END IF;
END $$;
