create or replace function public.bsc_capture_official_rankings(target_date date, target_timing text default 'previous_day')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  if target_timing not in ('previous_day','after_exhibition') then
    raise exception 'invalid timing: %', target_timing;
  end if;

  with latest_boats as (
    select distinct on (race_date, course_code, race_no, data_timing, boat_no)
      race_date, course_code, race_no, data_timing, boat_no,
      first_probability, second_probability, third_probability,
      predicted_at, model_version
    from public.ai_v2_predictions
    where race_date = target_date
      and data_timing = target_timing
    order by race_date, course_code, race_no, data_timing, boat_no, predicted_at desc nulls last, id desc
  ),
  selected as (
    select
      r.ranking_date,
      r.character_code,
      r.data_timing,
      r.ranking_type,
      r.rank_no,
      r.course_code,
      r.race_no,
      r.probability,
      r.model_version,
      r.summary,
      r.metrics
    from public.ai_v2_daily_rankings r
    where r.ranking_date = target_date
      and r.data_timing = target_timing
      and r.selected_for_home = true
      and r.character_code in ('ichika','hatsune','kiina')
  ),
  combos as (
    select
      s.*,
      b1.boat_no as first_boat,
      b2.boat_no as second_boat,
      b3.boat_no as third_boat,
      coalesce(b1.first_probability,0)
        * coalesce(b2.second_probability,0)
        * coalesce(b3.third_probability,0) as combo_score
    from selected s
    join latest_boats b1
      on b1.race_date=s.ranking_date and b1.course_code=s.course_code and b1.race_no=s.race_no and b1.data_timing=s.data_timing
    join latest_boats b2
      on b2.race_date=s.ranking_date and b2.course_code=s.course_code and b2.race_no=s.race_no and b2.data_timing=s.data_timing and b2.boat_no<>b1.boat_no
    join latest_boats b3
      on b3.race_date=s.ranking_date and b3.course_code=s.course_code and b3.race_no=s.race_no and b3.data_timing=s.data_timing and b3.boat_no<>b1.boat_no and b3.boat_no<>b2.boat_no
    where
      (s.character_code='ichika' and b1.boat_no=1)
      or (s.character_code='kiina' and b1.boat_no=5)
      or (s.ranking_type='hatsune_dominant_best3' and b1.boat_no=1)
      or (s.ranking_type='hatsune_risky_best3' and b1.boat_no<>1)
  ),
  ranked as (
    select *, row_number() over (
      partition by ranking_date, character_code, data_timing, ranking_type, rank_no
      order by combo_score desc, first_boat, second_boat, third_boat
    ) as ticket_rank
    from combos
  ),
  packed as (
    select
      ranking_date,
      character_code,
      data_timing,
      ranking_type,
      rank_no,
      course_code,
      race_no,
      probability,
      model_version,
      summary,
      metrics,
      jsonb_agg(to_jsonb(format('%s-%s-%s', first_boat, second_boat, third_boat)) order by ticket_rank) filter (where ticket_rank <= 5) as tickets,
      jsonb_agg(jsonb_build_object(
        'ticket', format('%s-%s-%s', first_boat, second_boat, third_boat),
        'score', combo_score
      ) order by ticket_rank) filter (where ticket_rank <= 5) as ticket_scores
    from ranked
    where ticket_rank <= 5
    group by ranking_date, character_code, data_timing, ranking_type, rank_no, course_code, race_no, probability, model_version, summary, metrics
  )
  insert into public.bsc_official_predictions (
    race_date, course_code, race_no, character_code, timing,
    ranking_type, rank_no, source_table, source_id,
    prediction_label, tickets, unit_stake, snapshot, published_at
  )
  select
    p.ranking_date,
    p.course_code,
    p.race_no,
    p.character_code,
    p.data_timing,
    p.ranking_type,
    p.rank_no,
    'ai_v2_daily_rankings',
    format('%s:%s:%s:%s', p.ranking_date, p.data_timing, p.ranking_type, p.rank_no),
    case
      when p.ranking_type='ichika_escape_best10' then '一果 イン逃げ'
      when p.ranking_type='hatsune_dominant_best3' then '初音 イン逃げ圧倒'
      when p.ranking_type='hatsune_risky_best3' then '初音 イン不安'
      when p.ranking_type='kiina_boat5_best5' then 'キイナ 5アタマ'
      else p.ranking_type
    end,
    p.tickets,
    100,
    jsonb_build_object(
      'ranking_probability', p.probability,
      'ranking_model_version', p.model_version,
      'summary', p.summary,
      'metrics', coalesce(p.metrics,'{}'::jsonb),
      'ticket_scores', coalesce(p.ticket_scores,'[]'::jsonb),
      'ticket_generation', 'top5_position_probability_product_v1'
    ),
    now()
  from packed p
  where jsonb_array_length(coalesce(p.tickets,'[]'::jsonb)) > 0
  on conflict (character_code, timing, source_table, source_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.bsc_capture_official_rankings(date,text) from public;
grant execute on function public.bsc_capture_official_rankings(date,text) to service_role;