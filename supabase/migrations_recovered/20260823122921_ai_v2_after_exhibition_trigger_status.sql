create or replace function public.bs_ai_v2_after_exhibition_trigger_status(p_race_date date default current_date)
returns jsonb
language sql
security definer
set search_path = public
as $$
with api as (
  select max(api_preview_synced_at) as latest_api_change
  from public.bs_race_entries
  where race_date = p_race_date
), ai as (
  select max(predicted_at) as latest_ai_prediction
  from public.ai_v2_predictions
  where race_date = p_race_date
    and data_timing = 'after_exhibition'
    and model_version = 'ai-v2-shadow-selected-v1'
), complete as (
  select count(*) as complete_races
  from (
    select course_code, race_no
    from public.bs_race_entries
    where race_date = p_race_date
    group by course_code, race_no
    having count(*) = 6 and count(exhibition_time) = 6
  ) s
)
select jsonb_build_object(
  'race_date', p_race_date,
  'latest_api_change', api.latest_api_change,
  'latest_ai_prediction', ai.latest_ai_prediction,
  'complete_races', complete.complete_races,
  'needs_inference',
    api.latest_api_change is not null
    and complete.complete_races > 0
    and (ai.latest_ai_prediction is null or api.latest_api_change > ai.latest_ai_prediction)
)
from api, ai, complete;
$$;