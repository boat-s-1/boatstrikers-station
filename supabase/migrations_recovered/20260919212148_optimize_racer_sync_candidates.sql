
create or replace function public.bs_racer_sync_candidates(
  p_recent_days integer default 90,
  p_limit integer default 100
)
returns table (
  racer_registration_no text,
  racer_name text,
  racer_name_kana text,
  racer_branch text,
  racer_class text,
  gender text
)
language sql
stable
security invoker
set search_path = public
as $$
  with recent_racers as (
    select
      e.racer_registration_no,
      max(e.race_date) as latest_race_date
    from public.bs_race_entries e
    where e.racer_registration_no is not null
      and btrim(e.racer_registration_no) <> ''
      and e.race_date >= current_date - greatest(p_recent_days, 1)
    group by e.racer_registration_no
  ),
  missing as (
    select
      rr.racer_registration_no,
      rr.latest_race_date
    from recent_racers rr
    where not exists (
      select 1 from public.bs_racers r
      where r.registration_no = rr.racer_registration_no
    )
    order by rr.latest_race_date desc, rr.racer_registration_no
    limit least(greatest(p_limit, 1), 500)
  )
  select
    m.racer_registration_no,
    latest.racer_name,
    latest.racer_name_kana,
    latest.racer_branch,
    latest.racer_class,
    latest.gender
  from missing m
  cross join lateral (
    select
      e.racer_name,
      e.racer_name_kana,
      e.racer_branch,
      e.racer_class,
      e.gender
    from public.bs_race_entries e
    where e.racer_registration_no = m.racer_registration_no
    order by e.race_date desc, e.updated_at desc nulls last
    limit 1
  ) latest
  order by m.latest_race_date desc, m.racer_registration_no;
$$;

revoke all on function public.bs_racer_sync_candidates(integer, integer)
  from public, anon, authenticated;
grant execute on function public.bs_racer_sync_candidates(integer, integer)
  to service_role;
