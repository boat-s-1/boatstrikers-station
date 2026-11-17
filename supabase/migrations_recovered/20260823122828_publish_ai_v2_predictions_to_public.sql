create or replace function public.bs_publish_ai_v2_predictions(
  p_race_date date default current_date,
  p_timing text default 'after_exhibition'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with latest as (
    select distinct on (race_date, course_code, race_no, boat_no)
      race_date, course_code, race_no, boat_no,
      first_probability, ichika_probability,
      model_version, predicted_at
    from public.ai_v2_predictions
    where race_date = p_race_date
      and data_timing = p_timing
      and model_version = 'ai-v2-shadow-selected-v1'
    order by race_date, course_code, race_no, boat_no, predicted_at desc
  ), race_rows as (
    select
      race_date,
      course_code,
      race_no,
      max(ichika_probability) filter (where boat_no = 1) as escape_probability,
      max(predicted_at) as generated_at,
      (array_agg(boat_no order by first_probability desc nulls last, boat_no asc))[1:6] as top_boats
    from latest
    group by race_date, course_code, race_no
    having count(*) = 6
  ), upserted as (
    insert into public.bs_ai_predictions (
      race_date, course_code, race_no, character_code, timing,
      model_version, score, rank,
      main_boat, second_boat, third_boat, fourth_boat,
      danger_level, comment_text, bet_json, detail_json,
      published, predicted_at, updated_at,
      prediction_type, model_type, escape_probability,
      marks, factors, generated_at
    )
    select
      r.race_date,
      r.course_code,
      r.race_no,
      'ichika',
      p_timing,
      'ai-v2-shadow-selected-v1',
      round((coalesce(r.escape_probability, 0) * 100)::numeric, 3),
      case
        when coalesce(r.escape_probability,0) * 100 >= 85 then 'S'
        when coalesce(r.escape_probability,0) * 100 >= 75 then 'A'
        when coalesce(r.escape_probability,0) * 100 >= 65 then 'B'
        when coalesce(r.escape_probability,0) * 100 >= 55 then 'C'
        else 'D'
      end,
      r.top_boats[1]::smallint,
      r.top_boats[2]::smallint,
      r.top_boats[3]::smallint,
      r.top_boats[4]::smallint,
      null,
      null,
      '[]'::jsonb,
      jsonb_build_object(
        'bundle','ai-v2-shadow-selected-v1',
        'source','ai_v2',
        'data_timing',p_timing,
        'generated_at',r.generated_at,
        'escape_probability',r.escape_probability,
        'top_first_probability_boats',to_jsonb(r.top_boats)
      ),
      true,
      r.generated_at,
      now(),
      'ai_v2',
      'lightgbm',
      r.escape_probability,
      '[]'::jsonb,
      '{}'::jsonb,
      r.generated_at
    from race_rows r
    on conflict (race_date,course_code,race_no,character_code,timing)
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
      published = excluded.published,
      predicted_at = excluded.predicted_at,
      updated_at = now(),
      prediction_type = excluded.prediction_type,
      model_type = excluded.model_type,
      escape_probability = excluded.escape_probability,
      marks = excluded.marks,
      factors = excluded.factors,
      generated_at = excluded.generated_at
    returning 1
  )
  select count(*) into v_count from upserted;

  return jsonb_build_object(
    'ok', true,
    'race_date', p_race_date,
    'timing', p_timing,
    'published_races', v_count
  );
end;
$$;