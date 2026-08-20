create or replace function public.ai_v2_public_character_stats(p_as_of date default current_date)
returns table (
  ranking_type text,
  predictions bigint,
  hits bigint,
  hit_rate numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with resolved as (
    select
      r.ranking_type,
      coalesce(
        x.first_boat,
        nullif(substring(coalesce(x.trifecta_result, x.winning_trifecta, '') from '^\s*([1-6])'), '')::int
      ) as first_boat
    from public.ai_v2_daily_rankings r
    join public.bs_race_results x
      on x.race_date = r.ranking_date
     and x.course_code = r.course_code
     and x.race_no = r.race_no
    where r.data_timing = 'previous_day'
      and r.ranking_date < p_as_of
      and r.ranking_type in (
        'ichika_escape_best10',
        'hatsune_dominant_best3',
        'hatsune_risky_best3',
        'kiina_boat5_best5'
      )
  ), scored as (
    select
      ranking_type,
      first_boat,
      case
        when ranking_type in ('ichika_escape_best10', 'hatsune_dominant_best3') then first_boat = 1
        when ranking_type = 'hatsune_risky_best3' then first_boat <> 1
        when ranking_type = 'kiina_boat5_best5' then first_boat = 5
        else false
      end as is_hit
    from resolved
    where first_boat is not null
  )
  select
    ranking_type,
    count(*)::bigint as predictions,
    count(*) filter (where is_hit)::bigint as hits,
    round(
      100.0 * count(*) filter (where is_hit) / nullif(count(*), 0),
      1
    ) as hit_rate
  from scored
  group by ranking_type;
$$;

revoke all on function public.ai_v2_public_character_stats(date) from public;
grant execute on function public.ai_v2_public_character_stats(date) to service_role;
