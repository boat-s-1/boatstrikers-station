-- Isolated candidate only. Caller must verify the full official schedule and six-boat roster.
-- This site-only snapshot does not alter the live race, result, or prediction tables.
CREATE SCHEMA IF NOT EXISTS bs_program_stage;
REVOKE ALL ON SCHEMA bs_program_stage FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA bs_program_stage TO service_role;

CREATE TABLE IF NOT EXISTS bs_program_stage.race_day_program (
  race_date date PRIMARY KEY,
  captured_at timestamptz NOT NULL,
  program jsonb NOT NULL
);
REVOKE ALL ON bs_program_stage.race_day_program FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON bs_program_stage.race_day_program TO service_role;

CREATE OR REPLACE FUNCTION public.bs_stage_site_race_day_program_candidate(
  p_date date, p_captured_at timestamptz, p_events jsonb, p_entries jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog
SET lock_timeout = '2s'
AS $fn$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_today date := (v_now AT TIME ZONE 'Asia/Tokyo')::date;
  v_first_closing timestamptz;
  v_snapshot jsonb;
  v_inserted integer;
BEGIN
  IF p_date IS DISTINCT FROM v_today OR p_captured_at IS NULL
    OR p_captured_at > v_now OR (p_captured_at AT TIME ZONE 'Asia/Tokyo')::date <> v_today THEN
    RAISE EXCEPTION 'JST race-day capture required';
  END IF;
  IF jsonb_typeof(p_events) IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_entries) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_events) NOT BETWEEN 1 AND 288
    OR jsonb_array_length(p_entries) <> 6 * jsonb_array_length(p_events) THEN
    RAISE EXCEPTION 'complete program arrays required';
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
    RAISE EXCEPTION 'invalid race-day program keys or registrations';
  END IF;

  SELECT (p_date + min((e->>'closing_time')::time)) AT TIME ZONE 'Asia/Tokyo'
    INTO v_first_closing FROM jsonb_array_elements(p_events) e;
  IF v_now >= v_first_closing OR p_captured_at >= v_first_closing THEN
    RAISE EXCEPTION 'first official closing already reached';
  END IF;
  SELECT jsonb_build_object(
    'events', (SELECT jsonb_agg(row ORDER BY (row->>'course_code')::int, (row->>'race_no')::int)
      FROM jsonb_array_elements(p_events) row),
    'entries', (SELECT jsonb_agg(row ORDER BY (row->>'course_code')::int,
      (row->>'race_no')::int, (row->>'boat_no')::int) FROM jsonb_array_elements(p_entries) row)
  ) INTO v_snapshot;
  INSERT INTO bs_program_stage.race_day_program(race_date, captured_at, program)
  VALUES (p_date, p_captured_at, v_snapshot) ON CONFLICT (race_date) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF NOT EXISTS (SELECT 1 FROM bs_program_stage.race_day_program
    WHERE race_date = p_date AND program = v_snapshot) THEN
    RAISE EXCEPTION 'race-day snapshot differs from already staged program';
  END IF;
  IF (clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::date <> v_today THEN
    RAISE EXCEPTION 'JST day changed before staging';
  END IF;
  RETURN jsonb_build_object('snapshots_inserted', v_inserted);
END;
$fn$;
REVOKE ALL ON FUNCTION public.bs_stage_site_race_day_program_candidate(date,timestamptz,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_stage_site_race_day_program_candidate(date,timestamptz,jsonb,jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.bs_read_site_race_day_program_candidate(p_date date)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog
AS $fn$
  SELECT jsonb_build_object('race_date', s.race_date, 'captured_at', s.captured_at,
    'capture_timing', 'race_day_morning', 'program', s.program)
  FROM bs_program_stage.race_day_program s
  WHERE s.race_date = p_date
    AND s.race_date = (statement_timestamp() AT TIME ZONE 'Asia/Tokyo')::date
    AND (s.captured_at AT TIME ZONE 'Asia/Tokyo')::date = s.race_date
    AND s.captured_at <= statement_timestamp();
$fn$;
REVOKE ALL ON FUNCTION public.bs_read_site_race_day_program_candidate(date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_read_site_race_day_program_candidate(date)
  TO service_role;
