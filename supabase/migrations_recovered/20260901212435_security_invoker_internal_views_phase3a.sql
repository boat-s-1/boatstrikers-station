-- Phase 3a: internal/admin-only views.
-- Make them respect caller RLS and remove direct anon/authenticated access.

alter view public.v_ai_active_calibration_models set (security_invoker = true);
alter view public.v_ai_calibration_comparison set (security_invoker = true);
alter view public.v_ai_calibration_model_comparison set (security_invoker = true);
alter view public.v_ai_control_job_summary set (security_invoker = true);
alter view public.v_ai_control_job_summary_v14 set (security_invoker = true);
alter view public.v_ai_factory_summary set (security_invoker = true);
alter view public.v_ai_factory_worker_health set (security_invoker = true);
alter view public.v_ai_worker_health_v14 set (security_invoker = true);
alter view public.v_boat_strikers_ai_latest_models set (security_invoker = true);
alter view public.v_bs_ai_history_quality set (security_invoker = true);
alter view public.v_gender_data_quality set (security_invoker = true);
alter view public.v_race_data_quality set (security_invoker = true);

revoke all on public.v_ai_active_calibration_models from anon, authenticated;
revoke all on public.v_ai_calibration_comparison from anon, authenticated;
revoke all on public.v_ai_calibration_model_comparison from anon, authenticated;
revoke all on public.v_ai_control_job_summary from anon, authenticated;
revoke all on public.v_ai_control_job_summary_v14 from anon, authenticated;
revoke all on public.v_ai_factory_summary from anon, authenticated;
revoke all on public.v_ai_factory_worker_health from anon, authenticated;
revoke all on public.v_ai_worker_health_v14 from anon, authenticated;
revoke all on public.v_boat_strikers_ai_latest_models from anon, authenticated;
revoke all on public.v_bs_ai_history_quality from anon, authenticated;
revoke all on public.v_gender_data_quality from anon, authenticated;
revoke all on public.v_race_data_quality from anon, authenticated;

grant select on public.v_ai_active_calibration_models to service_role;
grant select on public.v_ai_calibration_comparison to service_role;
grant select on public.v_ai_calibration_model_comparison to service_role;
grant select on public.v_ai_control_job_summary to service_role;
grant select on public.v_ai_control_job_summary_v14 to service_role;
grant select on public.v_ai_factory_summary to service_role;
grant select on public.v_ai_factory_worker_health to service_role;
grant select on public.v_ai_worker_health_v14 to service_role;
grant select on public.v_boat_strikers_ai_latest_models to service_role;
grant select on public.v_bs_ai_history_quality to service_role;
grant select on public.v_gender_data_quality to service_role;
grant select on public.v_race_data_quality to service_role;