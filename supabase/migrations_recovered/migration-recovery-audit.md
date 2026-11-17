# Migration recovery audit — static screening

Date: 2026-11-18
Branch: `codex/migration-recovery-audit-20261118`
Scope: 133 SQL payloads reconstructed from production `supabase_migrations.schema_migrations`.

## Screening results

| Lexical marker | Count | Interpretation |
|---|---:|---|
| Cron scheduling markers (`cron.schedule`, `cron.unschedule`, `cron.alter_job`) | 9 | Requires isolated Cron-state review |
| Destructive-looking tokens (`DROP`, `TRUNCATE`, `DELETE FROM`) | 38 | Requires statement-level review; may be safe scoped deletes/backfills |
| Privilege tokens (`GRANT`, `REVOKE`) | 46 | Requires role/ACL review |

These are simple case-insensitive substring screens, not SQL parsing or semantic judgments. A token may occur in a comment, function body, or safe scoped operation; conversely, other risky operations may not be caught. Counts overlap.

## Cron-related migrations

`schedule_openapi_live_sync`, `boat4_double_top_alerts`, `schedule_ichika_hidden_escape_line`, `schedule_hatsune_womens_inner_break_line`, `schedule_engine_v3_weekly`, `engine_v3_cron_no_timeout`, `schedule_ichika_escape_surge_line_cron`, `automate_official_performance_sync`, `restore_results_and_harden_daily_sync`

## Destructive-token migrations

`ai_v2_training_refresh`, `ai_v2_training_top3_recovery`, `ai_v2_training_rows_compact`, `ai_v2_champion_challenger_registry`, `ai_v2_daily_ranking_type_expand`, `ai_v2_site_prediction_bridge`, `create_hatsune_news`, `hatsune_news_article_body`, `hatsune_news_ai_generation`, `create_boatstrikers_member_profiles`, `add_member_line_link_codes`, `allow_editorial_hatsune_categories`, `add_boatstrikers_media_videos`, `trigger_ichika_escape_surge_on_exhibition_update`, `enable_rls_public_tables_phase2`, `secure_public_ai_today_views_phase3c`, `secure_public_ai_bet_aggregates_phase3d`, `create_resort_style_management`, `optimize_resort_style_rls`, `alert_exhibition_provenance`, `backfill_alert_exhibition_provenance`, `add_theory_recommendation_snapshots`, `add_source_first_seen_tracking`, `fix_hatsune_news_source_key_unique_index`, `allow_bs_data_template_article_body_source`, `freeze_published_bets`, `hatsune_kiina_published_snapshots`, `hatsune_kiina_snapshot_retry_on_probabilities`, `member_conversion_analytics`, `create_newspaper_publications`, `create_ichika_ai_analysis_metrics`, `create_hatsune_kiina_ai_analysis_metrics`, `bootstrap_reconcile_and_result_provenance`, `expand_character_book_series`, `trinity_shadow_snapshots`, `trinity_official_previous_day_source`, `admin_job_locks`, `s01_bsc_results_restrict_public_writes_20261116`

## Privilege-token migrations

`ai_v2_public_character_stats`, `add_openapi_preview_fallback`, `add_openapi_preview_weather_fallback`, `ichika_hidden_escape_alerts`, `exhibition_acquisition_status`, `add_boatstrikers_media_videos`, `restrict_public_security_definer_writes_phase1`, `enable_rls_public_tables_phase2`, `security_invoker_internal_views_phase3a`, `secure_public_ai_bet_aggregates_phase3d`, `secure_legacy_ai_and_female_views_phase3e`, `create_resort_style_management`, `add_resort_customer_booking_operations`, `add_data_lab_social_outputs`, `discord_premium_notifications`, `create_bs_x_night_snapshots`, `create_bsc_official_performance_engine`, `add_official_prediction_capture_from_ai_v2`, `automate_official_performance_sync`, `member_conversion_analytics`, `add_safe_original_exhibition_fill_rpc_v1`, `lock_down_original_exhibition_fill_rpc_v1`, `restore_results_and_harden_daily_sync`, `add_race_data_quality_alerts`, `secure_internal_tables_and_functions`, `create_newspaper_publications`, `create_bs_racers`, `add_today_birthday_racers_rpc`, `optimize_racer_sync_candidates`, `add_racer_sync_queue`, `create_ichika_ai_analysis_metrics`, `create_hatsune_kiina_ai_analysis_metrics`, `add_openapi_bootstrap_rpc`, `bootstrap_reconcile_and_result_provenance`, `mark_pc_kyotei_result_provenance`, `ichika_book_issues`, `trinity_shadow_snapshots`, `trinity_official_previous_day_source`, `admin_job_locks`, `create_gamagori_chart_boat_ratings`, `gamagori_collector_global_lease`, `gamagori_collection_orchestrator_state`, `gamagori_database_meeting_evidence`, `gamagori_evidence_all_six_fresh`, `gamagori_meeting_evidence_active_roster`, `s01_bsc_results_restrict_public_writes_20261116`

## Replay decision

**HOLD — no migration in this recovery set is approved for replay.**

Before isolated replay, perform a statement-level review of:
- dependencies between functions, tables, views, triggers, extensions, and policies;
- statements that mutate/backfill production data or assume existing rows;
- Cron job names, schedules, duplicate-job behavior, and external HTTP effects;
- grants/revokes and RLS/security-invoker/security-definer behavior;
- destructive DDL and any statements whose effects are not reversible.

A clean-room test database should be provisioned with a known baseline, then migrations applied in exact version order with assertions after each logical group. Cron should remain disabled or redirected to inert test targets until separately approved.

## Provenance limitation

The registry stores a `text[]` of SQL statements. The recovered files join those elements with `\n;\n`. SHA-256 values are over this reconstructed payload, not necessarily the original developer-authored migration file bytes. This audit does not claim byte-identical source recovery.
