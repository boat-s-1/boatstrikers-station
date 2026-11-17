-- Restrict internal operational tables and SECURITY DEFINER functions.
alter table public.bs_news_sync_logs enable row level security;
alter table public.bs_elimination_odds_snapshots enable row level security;
alter table public.bs_x_night_posts enable row level security;

revoke all on table public.bs_news_sync_logs from public, anon, authenticated;
revoke all on table public.bs_elimination_odds_snapshots from public, anon, authenticated;
revoke all on table public.bs_x_night_posts from public, anon, authenticated;

grant all on table public.bs_news_sync_logs to service_role;
grant all on table public.bs_elimination_odds_snapshots to service_role;
grant all on table public.bs_x_night_posts to service_role;

revoke all on function public.ai_v2_public_character_stats(date) from public, anon, authenticated;
revoke all on function public.bs_ai_v2_after_exhibition_trigger_status(date) from public, anon, authenticated;
revoke all on function public.bs_build_stadium_ai_payload(smallint,date) from public, anon, authenticated;
revoke all on function public.bs_build_stadium_ai_payload_v2(smallint,date) from public, anon, authenticated;
revoke all on function public.bs_capture_theory_recommendation() from public, anon, authenticated;
revoke all on function public.bs_engine_v3_status() from public, anon, authenticated;
revoke all on function public.bs_log_member_plan_change() from public, anon, authenticated;
revoke all on function public.bs_settle_theory_recommendation(bigint) from public, anon, authenticated;
revoke all on function public.bs_settle_theory_recommendations_from_event() from public, anon, authenticated;
revoke all on function public.bsc_capture_official_rankings(date,text) from public, anon, authenticated;
revoke all on function public.bsc_freeze_specialist_ranking_by_id(bigint) from public, anon, authenticated;
revoke all on function public.bsc_refresh_official_performance() from public, anon, authenticated;
revoke all on function public.bsc_settle_official_predictions(date) from public, anon, authenticated;
revoke all on function public.bsc_sync_official_results_to_legacy() from public, anon, authenticated;

grant execute on function public.ai_v2_public_character_stats(date) to postgres, service_role;
grant execute on function public.bs_ai_v2_after_exhibition_trigger_status(date) to postgres, service_role;
grant execute on function public.bs_build_stadium_ai_payload(smallint,date) to postgres, service_role;
grant execute on function public.bs_build_stadium_ai_payload_v2(smallint,date) to postgres, service_role;
grant execute on function public.bs_capture_theory_recommendation() to postgres, service_role;
grant execute on function public.bs_engine_v3_status() to postgres, service_role;
grant execute on function public.bs_log_member_plan_change() to postgres, service_role;
grant execute on function public.bs_settle_theory_recommendation(bigint) to postgres, service_role;
grant execute on function public.bs_settle_theory_recommendations_from_event() to postgres, service_role;
grant execute on function public.bsc_capture_official_rankings(date,text) to postgres, service_role;
grant execute on function public.bsc_freeze_specialist_ranking_by_id(bigint) to postgres, service_role;
grant execute on function public.bsc_refresh_official_performance() to postgres, service_role;
grant execute on function public.bsc_settle_official_predictions(date) to postgres, service_role;
grant execute on function public.bsc_sync_official_results_to_legacy() to postgres, service_role;