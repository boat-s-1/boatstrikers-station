-- This fixture is deliberately single-use: a repeat must fail its precondition.
-- Use on a disposable isolated database only; cancellation, provenance and
-- settlement side effects require separate checks before a batch version.
-- ISOLATION FIXTURE ONLY. Never run on production.
-- Replace :fixture_date, :course_code, :race_no via client binding after review.
-- The calling transaction must contain the preceding bootstrap and expected counts.
BEGIN;
DO $guard$
DECLARE
  v_key_count integer;
  v_entry_count integer;
  v_recommendation_count integer;
  v_updated integer;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE e.race_status='scheduled'
    AND e.data_source='BOATRACE_OPEN_API_BOOTSTRAP'
    AND e.trifecta IS NULL AND e.trifecta_payout IS NULL
    AND e.result_source IS NULL AND e.payout_source IS NULL)
  INTO v_key_count, v_updated
  FROM public.bs_race_events e
  WHERE e.race_date = DATE '2020-01-02' AND e.course_code = 24 AND e.race_no = 12;
  IF v_key_count <> 1 OR v_updated <> 1 THEN
    RAISE EXCEPTION 'event precondition failed: %, %', v_key_count, v_updated;
  END IF;

  SELECT count(DISTINCT boat_no) INTO v_entry_count
  FROM public.bs_race_entries
  WHERE race_date = DATE '2020-01-02' AND course_code = 24 AND race_no = 12;
  IF v_entry_count <> 6 THEN
    RAISE EXCEPTION 'six-boat precondition failed: %', v_entry_count;
  END IF;

  SELECT count(*) INTO v_key_count FROM public.bs_race_results r
  WHERE r.race_date=DATE '2020-01-02' AND r.course_code=24 AND r.race_no=12
    AND r.result_status='confirmed' AND r.race_status='finished'
    AND r.trifecta_result IS NOT NULL AND r.trifecta_payout IS NOT NULL;
  IF v_key_count <> 1 THEN
    RAISE EXCEPTION 'confirmed-result precondition failed: %', v_key_count;
  END IF;

  SELECT count(*) INTO v_recommendation_count FROM public.bs_theory_recommendations
  WHERE race_date=DATE '2020-01-02' AND course_code=24 AND race_no=12;

  UPDATE public.bs_race_events e SET
    race_status='finished', result_available=true,
    trifecta=r.trifecta_result, trifecta_payout=r.trifecta_payout,
    result_source=coalesce(r.api_result_source,'existing_confirmed_result'),
    result_synced_at=r.api_result_synced_at,
    payout_source=coalesce(r.api_result_source,'existing_confirmed_result'),
    payout_synced_at=r.api_result_synced_at
  FROM public.bs_race_results r
  WHERE e.race_date=DATE '2020-01-02' AND e.course_code=24 AND e.race_no=12
    AND r.race_date=e.race_date AND r.course_code=e.course_code AND r.race_no=e.race_no
    AND e.race_status='scheduled'
    AND e.data_source='BOATRACE_OPEN_API_BOOTSTRAP'
    AND e.trifecta IS NULL AND e.trifecta_payout IS NULL
    AND e.result_source IS NULL AND e.payout_source IS NULL
    AND r.result_status='confirmed' AND r.race_status='finished'
    AND r.trifecta_result IS NOT NULL AND r.trifecta_payout IS NOT NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN RAISE EXCEPTION 'expected one update, got %', v_updated; END IF;

  SELECT count(*) INTO v_key_count FROM public.bs_theory_recommendations
  WHERE race_date=DATE '2020-01-02' AND course_code=24 AND race_no=12;
  IF v_key_count <> v_recommendation_count THEN
    RAISE EXCEPTION 'theory recommendation count changed';
  END IF;
END $guard$;
COMMIT;
