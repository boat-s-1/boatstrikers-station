create or replace function public.bsc_freeze_specialist_ranking_by_id(target_ranking_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ranking_row public.ai_v2_daily_rankings%rowtype;
  frozen_tickets jsonb := '[]'::jsonb;
  ticket_scores jsonb := '[]'::jsonb;
  ticket_count integer := 0;
  boat_count integer := 0;
begin
  select *
  into ranking_row
  from public.ai_v2_daily_rankings
  where id = target_ranking_id
    and selected_for_home = true
    and character_code in ('hatsune','kiina');

  if not found then
    return false;
  end if;

  if exists (
    select 1
    from public.bsc_official_predictions p
    where p.character_code = ranking_row.character_code
      and p.timing = ranking_row.data_timing
      and p.source_table = 'ai_v2_daily_rankings_published'
      and p.source_id = ranking_row.id::text
  ) then
    return true;
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
      third_probability
    from public.ai_v2_predictions
    where race_date = ranking_row.ranking_date
      and course_code = ranking_row.course_code
      and race_no = ranking_row.race_no
      and data_timing = ranking_row.data_timing
    order by race_date, course_code, race_no, data_timing, boat_no,
             predicted_at desc nulls last, id desc
  )
  select count(*)::integer into boat_count from latest_boats;

  -- Do not freeze from a partially-written probability set.
  if boat_count <> 6 then
    return false;
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
      third_probability
    from public.ai_v2_predictions
    where race_date = ranking_row.ranking_date
      and course_code = ranking_row.course_code
      and race_no = ranking_row.race_no
      and data_timing = ranking_row.data_timing
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
      (ranking_row.character_code='kiina' and b1.boat_no=5)
      or (
        ranking_row.character_code='hatsune'
        and ranking_row.ranking_type='hatsune_dominant_best3'
        and b1.boat_no=1
      )
      or (
        ranking_row.character_code='hatsune'
        and ranking_row.ranking_type='hatsune_risky_best3'
        and b1.boat_no<>1
      )
  ),
  ranked as (
    select *, row_number() over (
      order by combo_score desc, first_boat, second_boat, third_boat
    ) as ticket_rank
    from combos
  )
  select
    coalesce(
      jsonb_agg(to_jsonb(format('%s-%s-%s', first_boat, second_boat, third_boat)) order by ticket_rank)
        filter (where ticket_rank <= 5),
      '[]'::jsonb
    ),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'ticket', format('%s-%s-%s', first_boat, second_boat, third_boat),
          'score', combo_score
        ) order by ticket_rank
      ) filter (where ticket_rank <= 5),
      '[]'::jsonb
    )
  into frozen_tickets, ticket_scores
  from ranked;

  ticket_count := jsonb_array_length(frozen_tickets);
  if ticket_count = 0 then
    return false;
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
    ranking_row.ranking_date,
    ranking_row.course_code,
    ranking_row.race_no,
    ranking_row.character_code,
    ranking_row.data_timing,
    ranking_row.ranking_type,
    ranking_row.rank_no,
    'ai_v2_daily_rankings_published',
    ranking_row.id::text,
    case
      when ranking_row.ranking_type='hatsune_dominant_best3' then '初音 女子戦イン優勢'
      when ranking_row.ranking_type='hatsune_risky_best3' then '初音 女子戦イン不安'
      when ranking_row.ranking_type='kiina_boat5_best5' then 'キイナ 5アタマ'
      else case ranking_row.character_code when 'hatsune' then '初音 公開買い目' else 'キイナ 公開買い目' end
    end,
    frozen_tickets,
    100,
    ticket_count * 100,
    jsonb_build_object(
      'source', 'published_daily_ranking',
      'ranking_id', ranking_row.id,
      'ranking_type', ranking_row.ranking_type,
      'rank_no', ranking_row.rank_no,
      'ranking_probability', ranking_row.probability,
      'ticket_scores', ticket_scores,
      'bet_count', ticket_count,
      'ticket_generation', 'top5_position_probability_product_at_publication_v1',
      'frozen_model_version', ranking_row.model_version
    ),
    clock_timestamp()
  )
  on conflict (character_code, timing, source_table, source_id) do nothing;

  return true;
end;
$$;

create or replace function public.bsc_freeze_published_specialist_ranking()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.character_code in ('hatsune','kiina')
     and coalesce(new.selected_for_home, false) then
    perform public.bsc_freeze_specialist_ranking_by_id(new.id);
  end if;
  return new;
end;
$$;

create or replace function public.bsc_try_freeze_specialist_rankings_from_prediction()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  ranking_id bigint;
begin
  for ranking_id in
    select r.id
    from public.ai_v2_daily_rankings r
    where r.ranking_date = new.race_date
      and r.course_code = new.course_code
      and r.race_no = new.race_no
      and r.data_timing = new.data_timing
      and r.selected_for_home = true
      and r.character_code in ('hatsune','kiina')
  loop
    perform public.bsc_freeze_specialist_ranking_by_id(ranking_id);
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_bsc_try_freeze_specialist_rankings_from_prediction on public.ai_v2_predictions;
create trigger trg_bsc_try_freeze_specialist_rankings_from_prediction
after insert or update on public.ai_v2_predictions
for each row
execute function public.bsc_try_freeze_specialist_rankings_from_prediction();
