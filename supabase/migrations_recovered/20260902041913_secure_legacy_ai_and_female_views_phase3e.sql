
alter view public.v_ai_latest_predictions set (security_invoker = true);
alter view public.v_ai_latest_predictions_by_race set (security_invoker = true);
alter view public.v_ai_prediction_movements set (security_invoker = true);
alter view public.v_ai_live_prediction_performance set (security_invoker = true);
alter view public.v_boat_strikers_ai_summary set (security_invoker = true);
alter view public.v_female_races set (security_invoker = true);
alter view public.v_ai_diagnosis_ranking set (security_invoker = true);
alter view public.v_ai_latest_calibrated_predictions set (security_invoker = true);
alter view public.v_ai_latest_diagnoses_v3 set (security_invoker = true);
alter view public.v_ai_diagnosis_ranking_v3 set (security_invoker = true);

revoke all on table
 public.v_ai_latest_predictions,
 public.v_ai_latest_predictions_by_race,
 public.v_ai_prediction_movements,
 public.v_ai_live_prediction_performance,
 public.v_boat_strikers_ai_summary,
 public.v_female_races,
 public.v_ai_diagnosis_ranking,
 public.v_ai_latest_calibrated_predictions,
 public.v_ai_latest_diagnoses_v3,
 public.v_ai_diagnosis_ranking_v3
from public, anon, authenticated;

grant select on table
 public.v_ai_latest_predictions,
 public.v_ai_latest_predictions_by_race,
 public.v_ai_prediction_movements,
 public.v_ai_live_prediction_performance,
 public.v_boat_strikers_ai_summary,
 public.v_female_races,
 public.v_ai_diagnosis_ranking,
 public.v_ai_latest_calibrated_predictions,
 public.v_ai_latest_diagnoses_v3,
 public.v_ai_diagnosis_ranking_v3
to service_role;
