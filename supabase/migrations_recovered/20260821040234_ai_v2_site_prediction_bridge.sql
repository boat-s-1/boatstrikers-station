create table if not exists public.bs_ai_predictions_legacy_archive as
select *, now()::timestamptz as archived_at
from public.bs_ai_predictions
with no data;

create or replace function public.ai_v2_sync_site_prediction(
  p_race_date date,
  p_course_code smallint,
  p_race_no smallint,
  p_data_timing text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_model_version text := 'ai-v2-shadow-selected-v1';
  v_escape_prob double precision;
  v_top_boats int[];
  v_predicted_at timestamptz;
  v_score numeric;
  v_rank text;
  v_danger text;
  v_marks jsonb;
  v_detail jsonb;
  v_existing public.bs_ai_predictions%rowtype;
begin
  if p_data_timing not in ('previous_day','after_exhibition') then
    return;
  end if;

  select count(*),
         max(case when boat_no = 1 then coalesce(ichika_probability, first_probability) end),
         max(predicted_at)
    into v_count, v_escape_prob, v_predicted_at
  from public.ai_v2_predictions
  where race_date = p_race_date
    and course_code = p_course_code
    and race_no = p_race_no
    and data_timing = p_data_timing
    and model_version = v_model_version;

  if v_count < 6 or v_escape_prob is null then
    return;
  end if;

  select array_agg(boat_no order by first_probability desc nulls last, boat_no asc)
    into v_top_boats
  from public.ai_v2_predictions
  where race_date = p_race_date
    and course_code = p_course_code
    and race_no = p_race_no
    and data_timing = p_data_timing
    and model_version = v_model_version;

  v_score := round((greatest(0.0, least(1.0, v_escape_prob)) * 100.0)::numeric, 3);
  v_rank := case
    when v_score >= 85 then 'S'
    when v_score >= 75 then 'A'
    when v_score >= 65 then 'B'
    when v_score >= 55 then 'C'
    else 'D'
  end;
  v_danger := case
    when v_score >= 80 then '低'
    when v_score >= 70 then 'やや低'
    when v_score >= 60 then '中'
    when v_score >= 50 then 'やや高'
    else '高'
  end;

  v_marks := jsonb_build_array(
    jsonb_build_object('mark','◎','boat_no',v_top_boats[1]),
    jsonb_build_object('mark','○','boat_no',v_top_boats[2]),
    jsonb_build_object('mark','▲','boat_no',v_top_boats[3])
  );

  v_detail := jsonb_build_object(
    'source','ai_v2',
    'bundle',v_model_version,
    'data_timing',p_data_timing,
    'escape_probability',v_escape_prob,
    'top_first_probability_boats',to_jsonb(v_top_boats),
    'generated_at',coalesce(v_predicted_at, now())
  );

  select * into v_existing
  from public.bs_ai_predictions
  where race_date = p_race_date
    and course_code = p_course_code
    and race_no = p_race_no
    and character_code = 'ichika'
    and timing = p_data_timing;

  if found and coalesce(v_existing.model_version,'') <> v_model_version then
    insert into public.bs_ai_predictions_legacy_archive
    select v_existing.*, now();
  end if;

  insert into public.bs_ai_predictions (
    race_date, course_code, race_no, character_code, timing,
    model_version, score, rank, main_boat, second_boat, third_boat, fourth_boat,
    danger_level, comment_text, bet_json, detail_json, published,
    predicted_at, updated_at, prediction_type, model_type,
    escape_probability, marks, factors, generated_at
  ) values (
    p_race_date, p_course_code, p_race_no, 'ichika', p_data_timing,
    v_model_version, v_score, v_rank, v_top_boats[1], v_top_boats[2], v_top_boats[3], v_top_boats[4],
    v_danger,
    case when p_data_timing = 'after_exhibition'
      then 'BoatStrikers AI v2 展示後予測。展示情報を含む最新モデル評価です。'
      else 'BoatStrikers AI v2 前日予測。展示情報を使わず出走表確定時点のデータで評価しています。'
    end,
    '[]'::jsonb, v_detail, true,
    coalesce(v_predicted_at, now()), now(), p_data_timing, 'lightgbm_v2',
    v_score, v_marks, '{}'::jsonb, coalesce(v_predicted_at, now())
  )
  on conflict (race_date, course_code, race_no, character_code, timing)
  do update set
    model_version = excluded.model_version,
    score = excluded.score,
    rank = excluded.rank,
    main_boat = excluded.main_boat,
    second_boat = excluded.second_boat,
    third_boat = excluded.third_boat,
    fourth_boat = excluded.fourth_boat,
    danger_level = excluded.danger_level,
    comment_text = excluded.comment_text,
    bet_json = excluded.bet_json,
    detail_json = excluded.detail_json,
    published = true,
    predicted_at = excluded.predicted_at,
    updated_at = now(),
    prediction_type = excluded.prediction_type,
    model_type = excluded.model_type,
    escape_probability = excluded.escape_probability,
    marks = excluded.marks,
    factors = excluded.factors,
    generated_at = excluded.generated_at;
end;
$$;

create or replace function public.ai_v2_prediction_site_bridge_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.model_version = 'ai-v2-shadow-selected-v1' then
    perform public.ai_v2_sync_site_prediction(new.race_date, new.course_code, new.race_no, new.data_timing);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ai_v2_prediction_site_bridge on public.ai_v2_predictions;
create trigger trg_ai_v2_prediction_site_bridge
after insert or update on public.ai_v2_predictions
for each row execute function public.ai_v2_prediction_site_bridge_trigger();