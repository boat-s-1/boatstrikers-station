create or replace function public.evaluate_boat4_double_top_alerts()
returns integer
language plpgsql
set search_path to 'public'
as $function$
declare
  inserted_count integer := 0;
begin
  with source as (
    select e.race_date,e.course_code,ev.course_name,e.race_no,e.boat_no,ev.closing_time,
      coalesce(e.official_exhibition_time,e.exhibition_time,e.api_exhibition_time) exhibition_time,
      coalesce(e.official_straight,e.straight_time) straight_time
    from public.bs_race_entries e
    join public.bs_race_events ev on ev.race_date=e.race_date and ev.course_code=e.course_code and ev.race_no=e.race_no
    where e.race_date=((now() at time zone 'Asia/Tokyo')::date)
  ), complete_races as (
    select race_date,course_code,race_no from source group by 1,2,3
    having count(*) filter(where exhibition_time is not null)=6
       and count(*) filter(where straight_time is not null)=6
  ), ranked as (
    select s.*,
      rank() over(partition by s.race_date,s.course_code,s.race_no order by s.exhibition_time asc nulls last)::smallint exhibition_rank,
      rank() over(partition by s.race_date,s.course_code,s.race_no order by s.straight_time asc nulls last)::smallint straight_rank
    from source s join complete_races c using(race_date,course_code,race_no)
  ), ins as (
    insert into public.bs_exhibition_alerts(race_date,course_code,course_name,race_no,boat_no,closing_time,exhibition_time,exhibition_rank,straight_time,straight_rank,detected_at,updated_at)
    select race_date,course_code,course_name,race_no,boat_no,closing_time,exhibition_time,exhibition_rank,straight_time,straight_rank,now(),now()
    from ranked
    where boat_no=4
      and exhibition_rank<=2
      and straight_rank<=2
      and (exhibition_rank=1 or straight_rank=1)
    on conflict(race_date,course_code,race_no,boat_no) do nothing returning 1
  ) select count(*) into inserted_count from ins;

  update public.bs_exhibition_alerts a
  set result_rank=case when r.first_boat=4 then 1 when r.second_boat=4 then 2 when r.third_boat=4 then 3 else null end,
      trifecta=coalesce(r.winning_trifecta,r.trifecta_result),trifecta_payout=r.trifecta_payout,
      result_synced_at=coalesce(r.api_result_synced_at,r.synced_at,now()),updated_at=now()
  from public.bs_race_results r
  where a.race_date=r.race_date and a.course_code=r.course_code and a.race_no=r.race_no
    and a.result_synced_at is null;

  update public.bs_exhibition_alerts a
  set result_rank=coalesce(e.arrival_order,nullif(regexp_replace(coalesce(e.finish_place,''),'[^0-9]','','g'),'')::integer),updated_at=now()
  from public.bs_race_entries e
  where a.race_date=e.race_date and a.course_code=e.course_code and a.race_no=e.race_no and e.boat_no=4
    and a.result_rank is null and (e.arrival_order is not null or e.finish_place is not null);

  return inserted_count;
end; $function$;