\set ON_ERROR_STOP on
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
\ir site-race-day-morning-snapshot.candidate.sql

DO $test$
DECLARE
  d date := (clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::date;
  events jsonb;
  entries jsonb;
  actual jsonb;
  result jsonb;
BEGIN
  IF has_function_privilege('anon', 'public.bs_stage_site_race_day_program_candidate(date,timestamptz,jsonb,jsonb)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.bs_read_site_race_day_program_candidate(date)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.bs_stage_site_race_day_program_candidate(date,timestamptz,jsonb,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'snapshot RPC privileges are wrong';
  END IF;
  events := jsonb_build_array(jsonb_build_object('race_date', d, 'course_code', 1,
    'race_no', 1, 'closing_time', '23:59'));
  SELECT jsonb_agg(jsonb_build_object('race_date', d, 'course_code', 1,
    'race_no', 1, 'boat_no', boat, 'racer_registration_no', (4000 + boat)::text))
    INTO entries FROM generate_series(1, 6) boat;
  BEGIN
    PERFORM public.bs_stage_site_race_day_program_candidate(d + 1, clock_timestamp(), events, entries);
    RAISE EXCEPTION 'accepted tomorrow as race-day capture';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'accepted tomorrow as race-day capture' THEN RAISE; END IF;
  END;
  IF (clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::time >= time '23:58' THEN
    RAISE NOTICE 'positive race-day fixture skipped at JST midnight boundary';
    RETURN;
  END IF;
  BEGIN
    PERFORM public.bs_stage_site_race_day_program_candidate(d, clock_timestamp(), events,
      entries - 5);
    RAISE EXCEPTION 'accepted five boats';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'accepted five boats' THEN RAISE; END IF;
  END;
  result := public.bs_stage_site_race_day_program_candidate(d, clock_timestamp(), events, entries);
  IF result->>'snapshots_inserted' <> '1' THEN RAISE EXCEPTION 'snapshot not inserted'; END IF;
  actual := public.bs_read_site_race_day_program_candidate(d);
  IF actual->>'capture_timing' <> 'race_day_morning'
    OR jsonb_array_length(actual->'program'->'entries') <> 6 THEN
    RAISE EXCEPTION 'morning snapshot read mismatch';
  END IF;
  result := public.bs_stage_site_race_day_program_candidate(d, clock_timestamp(), events, entries);
  IF result->>'snapshots_inserted' <> '0' THEN RAISE EXCEPTION 'replay inserted twice'; END IF;
  BEGIN
    PERFORM public.bs_stage_site_race_day_program_candidate(d, clock_timestamp(), events,
      jsonb_set(entries, '{0,racer_registration_no}', '"4999"'::jsonb));
    RAISE EXCEPTION 'accepted conflicting immutable snapshot';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'accepted conflicting immutable snapshot' THEN RAISE; END IF;
  END;
END $test$;
