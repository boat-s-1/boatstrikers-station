-- Isolated review only. Install after site-previous-day-snapshot.candidate.sql.
-- Return only the staged program and its capture time for today or tomorrow JST.
CREATE OR REPLACE FUNCTION public.bs_read_site_previous_day_program_candidate(p_date date)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog
AS $fn$
  SELECT jsonb_build_object(
    'race_date', s.race_date, 'captured_at', s.captured_at, 'program', s.program
  )
  FROM bs_program_stage.previous_day_program s
  WHERE s.race_date = p_date
    AND s.race_date BETWEEN (statement_timestamp() AT TIME ZONE 'Asia/Tokyo')::date
      AND (statement_timestamp() AT TIME ZONE 'Asia/Tokyo')::date + 1
    AND (s.captured_at AT TIME ZONE 'Asia/Tokyo')::date = s.race_date - 1
    AND s.captured_at <= statement_timestamp();
$fn$;
REVOKE ALL ON FUNCTION public.bs_read_site_previous_day_program_candidate(date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_read_site_previous_day_program_candidate(date)
  TO service_role;
