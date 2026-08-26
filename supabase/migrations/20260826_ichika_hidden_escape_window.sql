create or replace function public.evaluate_ichika_hidden_escape_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  with ranked as (
    select
      e.race_date,
      e.course_code,
      e.race_no,
      e.boat_no,
      coalesce(nullif(trim(e.racer_class), ''), nullif(trim(e."class"), '')) as racer_class,
      e.official_exhibition_time,
      e.official_lap,
      rank() over (partition by e.race_date, e.course_code, e.race_no order by e.official_exhibition_time asc nulls last)::smallint as exhibition_rank,
      rank() over (partition by e.race_date, e.course_code, e.race_no order by e.official_lap asc nulls last)::smallint as lap_rank,
      min(e.official_exhibition_time) over (partition by e.race_date, e.course_code, e.race_no) as exhibition_best_time
    from public.bs_race_entries e
    where e.race_date = (now() at time zone 'Asia/Tokyo')::date
      and e.official_exhibition_time is not null
      and e.official_lap is not null
  ), targets as (
    select
      r.*,
      ev.course_name,
      ev.closing_time,
      round((r.official_exhibition_time - r.exhibition_best_time)::numeric, 3) as exhibition_gap
    from ranked r
    join public.bs_race_events ev
      on ev.race_date = r.race_date
     and ev.course_code = r.course_code
     and ev.race_no = r.race_no
    where r.boat_no = 1
      and upper(coalesce(r.racer_class, '')) = 'B1'
      and r.exhibition_rank between 3 and 4
      and r.lap_rank = 1
      and (r.official_exhibition_time - r.exhibition_best_time) <= 0.03
      and ((ev.race_date + ev.closing_time) at time zone 'Asia/Tokyo') > now()
      and ((ev.race_date + ev.closing_time) at time zone 'Asia/Tokyo') <= now() + interval '30 minutes'
  )
  insert into public.bs_ichika_hidden_escape_alerts (
    race_date, course_code, course_name, race_no, closing_time,
    racer_class, exhibition_time, exhibition_rank, exhibition_best_time,
    exhibition_gap, lap_time, lap_rank, detected_at, updated_at
  )
  select
    race_date, course_code, course_name, race_no, closing_time,
    racer_class, official_exhibition_time, exhibition_rank, exhibition_best_time,
    exhibition_gap, official_lap, lap_rank, now(), now()
  from targets
  on conflict (race_date, course_code, race_no) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;
