-- Isolated review only. Install the row writer and stage writer first.
-- One RPC transaction commits the rows and the immutable snapshot together.
CREATE OR REPLACE FUNCTION public.bs_publish_site_previous_day_program_candidate(
  p_date date, p_captured_at timestamptz, p_events jsonb, p_entries jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog
SET lock_timeout = '2s'
AS $fn$
DECLARE
  v_rows jsonb;
  v_snapshot jsonb;
BEGIN
  v_rows := public.bs_apply_site_previous_day_program_candidate(
    p_date, p_captured_at, p_events, p_entries);
  v_snapshot := public.bs_stage_site_previous_day_program_candidate(
    p_date, p_captured_at, p_events, p_entries);
  RETURN jsonb_build_object('rows', v_rows, 'snapshot', v_snapshot);
END;
$fn$;
REVOKE ALL ON FUNCTION public.bs_publish_site_previous_day_program_candidate(date,timestamptz,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_publish_site_previous_day_program_candidate(date,timestamptz,jsonb,jsonb)
  TO service_role;
