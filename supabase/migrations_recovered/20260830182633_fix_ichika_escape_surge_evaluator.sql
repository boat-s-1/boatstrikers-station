create or replace function public.evaluate_ichika_escape_surge_alerts()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  with today_entries as (
    select
      e.race_date,
      e.course_code,
      e.race_no,
      e.boat_no,
      coalesce(e.official_exhibition_time, e.exhibition_time) as exhibition_time,
      coalesce(e.official_lap, e.lap_time) as lap_time,
      e.national_win_rate,
      e.local_win_rate
    from public.bs_race_entries e
    where e.race_date = (now() at time zone 'Asia/Tokyo')::date
  ),
  race_ready as (
    select
      race_date,
      course_code,
      race_no,
      min(exhibition_time) as best_exhibition,
      min(lap_time) as best_lap
    from today_entries
    group by race_date, course_code, race_no
    having count(*) filter (where exhibition_time is not null and lap_time is not null) = 6
  ),
  qualifying as (
    select
      t.race_date,
      t.course_code,
      t.race_no,
      t.exhibition_time,
      t.lap_time
    from today_entries t
    join race_ready r
      on r.race_date = t.race_date
     and r.course_code = t.course_code
     and r.race_no = t.race_no
    where t.boat_no = 1
      and t.exhibition_time = r.best_exhibition
      and t.lap_time = r.best_lap
  ),
  recommended as (
    select distinct on (t.race_date, t.course_code, t.race_no)
      t.race_date,
      t.course_code,
      t.race_no,
      t.boat_no as recommended_second_boat,
      t.national_win_rate as recommended_second_national_win_rate
    from today_entries t
    join qualifying q
      on q.race_date = t.race_date
     and q.course_code = t.course_code
     and q.race_no = t.race_no
    where t.boat_no between 2 and 6
    order by
      t.race_date,
      t.course_code,
      t.race_no,
      t.national_win_rate desc nulls last,
      t.local_win_rate desc nulls last,
      t.boat_no asc
  ),
  inserted as (
    insert into public.bs_ichika_escape_surge_alerts (
      race_date,
      course_code,
      course_name,
      race_no,
      closing_time,
      exhibition_time,
      lap_time,
      recommended_second_boat,
      recommended_second_national_win_rate
    )
    select
      q.race_date,
      q.course_code,
      ev.course_name,
      q.race_no,
      coalesce(ev.closing_time, ev.deadline_time),
      q.exhibition_time,
      q.lap_time,
      rec.recommended_second_boat,
      rec.recommended_second_national_win_rate
    from qualifying q
    left join public.bs_race_events ev
      on ev.race_date = q.race_date
     and ev.course_code = q.course_code
     and ev.race_no = q.race_no
    left join recommended rec
      on rec.race_date = q.race_date
     and rec.course_code = q.course_code
     and rec.race_no = q.race_no
    on conflict (race_date, course_code, race_no) do nothing
    returning 1
  )
  select count(*) into inserted_count from inserted;

  return inserted_count;
end;
$$;