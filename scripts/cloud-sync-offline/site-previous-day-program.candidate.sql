-- Isolated review only. The caller must independently verify the full official schedule and roster.
-- Uses the same per-race IDs as existing bootstrap so the day-of writer does not duplicate rows.
CREATE OR REPLACE FUNCTION public.bs_apply_site_previous_day_program_candidate(
  p_date date, p_captured_at timestamptz, p_events jsonb, p_entries jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public
SET lock_timeout = '2s'
AS $fn$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_today date := (v_now AT TIME ZONE 'Asia/Tokyo')::date;
  v_events integer;
  v_entries integer;
BEGIN
  IF p_date IS DISTINCT FROM v_today + 1 OR p_captured_at IS NULL
    OR p_captured_at > v_now OR (p_captured_at AT TIME ZONE 'Asia/Tokyo')::date <> v_today THEN
    RAISE EXCEPTION 'JST previous-day program required';
  END IF;
  IF jsonb_typeof(p_events) IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_entries) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'program arrays required';
  END IF;
  IF jsonb_array_length(p_events) NOT BETWEEN 1 AND 288
    OR jsonb_array_length(p_entries) <> 6 * jsonb_array_length(p_events) THEN
    RAISE EXCEPTION 'incomplete program';
  END IF;
  IF EXISTS (
    WITH events AS (
      SELECT * FROM jsonb_to_recordset(p_events) AS e(
        race_date date, course_code int, race_no int, closing_time time)
    ), entries AS (
      SELECT * FROM jsonb_to_recordset(p_entries) AS e(
        race_date date, course_code int, race_no int, boat_no int, racer_registration_no text)
    )
    SELECT 1 WHERE
      EXISTS (SELECT 1 FROM events WHERE race_date IS DISTINCT FROM p_date
        OR (course_code BETWEEN 1 AND 24) IS NOT TRUE
        OR (race_no BETWEEN 1 AND 12) IS NOT TRUE OR closing_time IS NULL)
      OR EXISTS (SELECT 1 FROM events GROUP BY course_code, race_no HAVING count(*) <> 1)
      OR EXISTS (SELECT 1 FROM entries WHERE race_date IS DISTINCT FROM p_date
        OR (course_code BETWEEN 1 AND 24) IS NOT TRUE
        OR (race_no BETWEEN 1 AND 12) IS NOT TRUE
        OR (boat_no BETWEEN 1 AND 6) IS NOT TRUE
        OR racer_registration_no IS NULL OR racer_registration_no !~ '^0?[0-9]{4}$'
        OR racer_registration_no IN ('0000', '00000'))
      OR EXISTS (SELECT 1 FROM events e LEFT JOIN entries b USING (course_code, race_no)
        GROUP BY e.course_code, e.race_no HAVING count(b.boat_no) <> 6
          OR count(DISTINCT b.boat_no) <> 6 OR count(DISTINCT ltrim(b.racer_registration_no, '0')) <> 6)
  ) THEN
    RAISE EXCEPTION 'invalid program keys or boat registrations';
  END IF;

  -- Serialize the check and inserts against other writers, including the existing bootstrap.
  LOCK TABLE public.bs_race_events, public.bs_race_entries IN SHARE ROW EXCLUSIVE MODE;
  IF (clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::date <> v_today THEN
    RAISE EXCEPTION 'JST day changed before saving program';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.bs_race_events e
    LEFT JOIN jsonb_to_recordset(p_events) AS p(course_code int, race_no int)
      USING (course_code, race_no)
    WHERE e.race_date = p_date AND p.race_no IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.bs_race_entries e
    LEFT JOIN jsonb_to_recordset(p_entries) AS p(
      course_code int, race_no int, boat_no int, racer_registration_no text)
      USING (course_code, race_no, boat_no)
    WHERE e.race_date = p_date
      AND (p.boat_no IS NULL OR ltrim(e.racer_registration_no::text, '0')
        IS DISTINCT FROM ltrim(p.racer_registration_no, '0'))
  ) THEN
    RAISE EXCEPTION 'saved program conflicts with official roster';
  END IF;

  INSERT INTO public.bs_race_events
    (id, race_date, course_code, race_no, closing_time, deadline_time, race_status,
      program_available, data_source, synced_at, created_at, updated_at)
  SELECT -((to_char(p_date, 'YYYYMMDD')::bigint * 10000) + course_code * 100 + race_no),
    p_date, course_code, race_no, closing_time, closing_time, 'scheduled',
    true, 'BOATRACE_OFFICIAL_PREVIOUS_DAY', p_captured_at, v_now, v_now
  FROM jsonb_to_recordset(p_events) AS e(course_code int, race_no int, closing_time time)
  ON CONFLICT (race_date, course_code, race_no) DO NOTHING;
  GET DIAGNOSTICS v_events = ROW_COUNT;

  INSERT INTO public.bs_race_entries
    (id, race_date, course_code, race_no, boat_no, racer_registration_no, racer_name,
      national_win_rate, local_win_rate, average_st, motor_2_rate, boat_2_rate,
      data_source, synced_at, created_at, updated_at)
  SELECT -((to_char(p_date, 'YYYYMMDD')::bigint * 100000) + course_code * 1000 + race_no * 10 + boat_no),
    p_date, course_code, race_no, boat_no, racer_registration_no, racer_name,
    national_win_rate, local_win_rate, average_st, motor_2_rate, boat_2_rate,
    'BOATRACE_OFFICIAL_PREVIOUS_DAY', p_captured_at, v_now, v_now
  FROM jsonb_to_recordset(p_entries) AS e(course_code int, race_no int, boat_no int,
    racer_registration_no text, racer_name text, national_win_rate numeric, local_win_rate numeric,
    average_st numeric, motor_2_rate numeric, boat_2_rate numeric)
  ON CONFLICT (race_date, course_code, race_no, boat_no) DO NOTHING;
  GET DIAGNOSTICS v_entries = ROW_COUNT;

  IF (SELECT count(*) FROM public.bs_race_events WHERE race_date = p_date) <> jsonb_array_length(p_events)
    OR (SELECT count(*) FROM public.bs_race_entries WHERE race_date = p_date) <> jsonb_array_length(p_entries)
    OR EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(p_entries) AS p(
        course_code int, race_no int, boat_no int, racer_registration_no text)
      LEFT JOIN public.bs_race_entries e
        ON e.race_date = p_date AND (e.course_code, e.race_no, e.boat_no)
          = (p.course_code, p.race_no, p.boat_no)
      WHERE ltrim(e.racer_registration_no::text, '0') IS DISTINCT FROM ltrim(p.racer_registration_no, '0')
    ) THEN
    RAISE EXCEPTION 'program postcondition failed';
  END IF;

  RETURN jsonb_build_object('events_inserted', v_events, 'entries_inserted', v_entries);
END;
$fn$;
REVOKE ALL ON FUNCTION public.bs_apply_site_previous_day_program_candidate(date,timestamptz,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_apply_site_previous_day_program_candidate(date,timestamptz,jsonb,jsonb)
  TO service_role;
