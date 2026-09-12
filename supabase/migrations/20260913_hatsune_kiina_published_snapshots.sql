create or replace function public.bsc_freeze_published_specialist_ranking()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  frozen_tickets jsonb := '[]'::jsonb;
  ticket_scores jsonb := '[]'::jsonb;
  ticket_count integer := 0;
begin
  if new.character_code not in ('hatsune','kiina')
     or not coalesce(new.selected_for_home, false) then
    return new;
  end if;

  -- Once this ranking has already been public, later refreshes must not alter
  -- the official ticket snapshot.
  if tg_op = 'UPDATE' and coalesce(old.selected_for_home, false) then
    return new;
  end if;

  with latest_boats as (
    select distinct on (race_date, course_code, race_no, data_timing, boat_no)
      race_date,
      course_code,
      race_no,
      data_timing,
      boat_no,
      first_probability,
      second_probability,
      third_probability,
      predicted_at,
      model_version
    from public.ai_v2_predictions
    where race_date = new.ranking_date
      and course_code = new.course_code
      and race_no = new.race_no
      and data_timing = new.data_timing
    order by race_date, course_code, race_no, data_timing, boat_no,
             predicted_at desc nulls last, id desc
  ),
  combos as (
    select
      b1.boat_no as first_boat,
      b2.boat_no as second_boat,
      b3.boat_no as third_boat,
      coalesce(b1.first_probability,0)
        * coalesce(b2.second_probability,0)
        * coalesce(b3.third_probability,0) as combo_score
    from latest_boats b1
    join latest_boats b2
      on b2.race_date=b1.race_date
     and b2.course_code=b1.course_code
     and b2.race_no=b1.race_no
     and b2.data_timing=b1.data_timing
     and b2.boat_no<>b1.boat_no
    join latest_boats b3
      on b3.race_date=b1.race_date
     and b3.course_code=b1.course_code
     and b3.race_no=b1.race_no
     and b3.data_timing=b1.data_timing
     and b3.boat_no<>b1.boat_no
     and b3.boat_no<>b2.boat_no
    where
      (new.character_code='kiina' and b1.boat_no=5)
      or (new.character_code='hatsune' and new.ranking_type='hatsune_dominant_best3' and b1.boat_no=1)
      or (new.character_code='hatsune' and new.ranking_type='hatsune_risky_best3' and b1.boat_no<>1)
  ),
  ranked as (
    select *, row_number() over (
      order by combo_score desc, first_boat, second_boat, third_boat
    ) as ticket_rank
    from combos
  ),
  packed as (
    select
      coalesce(
        jsonb_agg(to_jsonb(format('%s-%s-%s', first_boat, second_boat, third_boat)) order by ticket_rank)
          filter (where ticket_rank <= 5),
        '[]'::jsonb
      ) as tickets,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'ticket', format('%s-%s-%s', first_boat, second_boat, third_boat),
            'score', combo_score
          ) order by ticket_rank
        ) filter (where ticket_rank <= 5),
        '[]'::jsonb
      ) as scores
    from ranked
  )
  select tickets, scores, jsonb_array_length(tickets)
  into frozen_tickets, ticket_scores, ticket_count
  from packed;

  if ticket_count = 0 then
    return new;
  end if;

  insert into public.bsc_official_predictions (
    race_date,
    course_code,
    race_no,
    character_code,
    timing,
    ranking_type,
    rank_no,
    source_table,
    source_id,
    prediction_label,
    tickets,
    unit_stake,
    investment,
    snapshot,
    published_at
  ) values (
    new.ranking_date,
    new.course_code,
    new.race_no,
    new.character_code,
    new.data_timing,
    new.ranking_type,
    new.rank_no,
    'ai_v2_daily_rankings_published',
    new.id::text,
    case
      when new.ranking_type='hatsune_dominant_best3' then '初音 女子戦イン優勢'
      when new.ranking_type='hatsune_risky_best3' then '初音 女子戦イン不安'
      when new.ranking_type='kiina_boat5_best5' then 'キイナ 5アタマ'
      else case new.character_code when 'hatsune' then '初音 公開買い目' else 'キイナ 公開買い目' end
    end,
    frozen_tickets,
    100,
    ticket_count * 100,
    jsonb_build_object(
      'source', 'published_daily_ranking',
      'ranking_id', new.id,
      'ranking_type', new.ranking_type,
      'rank_no', new.rank_no,
      'ranking_probability', new.probability,
      'ticket_scores', ticket_scores,
      'bet_count', ticket_count,
      'ticket_generation', 'top5_position_probability_product_at_publication_v1',
      'frozen_model_version', new.model_version
    ),
    clock_timestamp()
  )
  on conflict (character_code, timing, source_table, source_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_bsc_freeze_published_specialist_ranking on public.ai_v2_daily_rankings;

create trigger trg_bsc_freeze_published_specialist_ranking
after insert or update on public.ai_v2_daily_rankings
for each row
execute function public.bsc_freeze_published_specialist_ranking();

-- Exact publication-time snapshots win over the older periodically rebuilt rows.
create or replace view public.v_bsc_official_performance as
select
  p.id as prediction_id,
  p.race_date,
  p.course_code,
  p.race_no,
  p.character_code,
  p.timing,
  p.ranking_type,
  p.rank_no,
  p.prediction_label,
  p.tickets,
  p.unit_stake,
  p.investment,
  p.published_at,
  r.result_combination,
  r.trifecta_payout,
  r.is_hit,
  r.hit_ticket,
  r.payout,
  r.profit,
  r.settled_at
from public.bsc_official_predictions p
join public.bsc_official_results r on r.prediction_id = p.id
where p.source_table in ('bs_ai_predictions','ai_v2_daily_rankings_published')
   or not exists (
     select 1
     from public.bsc_official_predictions exact
     where exact.source_table in ('bs_ai_predictions','ai_v2_daily_rankings_published')
       and exact.race_date = p.race_date
       and exact.course_code = p.course_code
       and exact.race_no = p.race_no
       and exact.character_code = p.character_code
       and exact.timing = p.timing
   );
