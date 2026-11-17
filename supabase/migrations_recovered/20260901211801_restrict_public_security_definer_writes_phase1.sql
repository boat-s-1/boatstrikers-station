-- Phase 1: close public execution paths for mutating SECURITY DEFINER functions
-- Keep service_role access for trusted backend/cron usage.

REVOKE EXECUTE ON FUNCTION public.activate_ai_model(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_ai_model(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.ai_v2_normalize_training_rows(date,date,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_v2_normalize_training_rows(date,date,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.ai_v2_prediction_site_bridge_trigger() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_v2_prediction_site_bridge_trigger() TO service_role;

REVOKE EXECUTE ON FUNCTION public.ai_v2_sync_site_prediction(date,smallint,smallint,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_v2_sync_site_prediction(date,smallint,smallint,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.backfill_racer_gender(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_racer_gender(boolean) TO service_role;

REVOKE EXECUTE ON FUNCTION public.bs_apply_official_exhibition_v10(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_apply_official_exhibition_v10(jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.bs_apply_official_exhibition_v7(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_apply_official_exhibition_v7(jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.bs_apply_openapi_preview(jsonb,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_apply_openapi_preview(jsonb,timestamptz) TO service_role;

REVOKE EXECUTE ON FUNCTION public.bs_apply_openapi_preview_events(jsonb,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_apply_openapi_preview_events(jsonb,timestamptz) TO service_role;

REVOKE EXECUTE ON FUNCTION public.bs_apply_openapi_results(jsonb,jsonb,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_apply_openapi_results(jsonb,jsonb,timestamptz) TO service_role;

REVOKE EXECUTE ON FUNCTION public.bs_engine_v3_refresh_all(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_engine_v3_refresh_all(date) TO service_role;

REVOKE EXECUTE ON FUNCTION public.bs_engine_v3_refresh_stadium(smallint,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_engine_v3_refresh_stadium(smallint,date) TO service_role;

REVOKE EXECUTE ON FUNCTION public.bs_publish_ai_v2_predictions(date,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_publish_ai_v2_predictions(date,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.bs_refresh_all_stadium_ai_v2(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_refresh_all_stadium_ai_v2(date) TO service_role;

REVOKE EXECUTE ON FUNCTION public.bs_refresh_all_stadium_data_engine_v2(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_refresh_all_stadium_data_engine_v2(date) TO service_role;

REVOKE EXECUTE ON FUNCTION public.bs_refresh_exhibition_ai_v2(smallint,date,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_refresh_exhibition_ai_v2(smallint,date,date) TO service_role;

REVOKE EXECUTE ON FUNCTION public.bs_refresh_stadium_ai(smallint,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_refresh_stadium_ai(smallint,date) TO service_role;

REVOKE EXECUTE ON FUNCTION public.bs_refresh_stadium_ai_v2(smallint,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_refresh_stadium_ai_v2(smallint,date) TO service_role;

REVOKE EXECUTE ON FUNCTION public.bs_refresh_stadium_data_book_v3(smallint,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_refresh_stadium_data_book_v3(smallint,date) TO service_role;

REVOKE EXECUTE ON FUNCTION public.bs_refresh_stadium_data_engine(smallint,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_refresh_stadium_data_engine(smallint,date) TO service_role;

REVOKE EXECUTE ON FUNCTION public.bs_refresh_stadium_data_engine_v2(smallint,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_refresh_stadium_data_engine_v2(smallint,date) TO service_role;

REVOKE EXECUTE ON FUNCTION public.bs_sync_openapi_today() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_sync_openapi_today() TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_next_ai_factory_job(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_ai_factory_job(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.evaluate_hatsune_box_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_hatsune_box_alerts() TO service_role;

REVOKE EXECUTE ON FUNCTION public.evaluate_hatsune_womens_inner_break_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_hatsune_womens_inner_break_alerts() TO service_role;

REVOKE EXECUTE ON FUNCTION public.evaluate_ichika_hidden_escape_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_ichika_hidden_escape_alerts() TO service_role;

REVOKE EXECUTE ON FUNCTION public.handle_boatstrikers_member_signup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_boatstrikers_member_signup() TO service_role;