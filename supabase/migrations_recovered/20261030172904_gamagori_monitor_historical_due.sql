create or replace function public.bsc_gamagori_chart_monitor(p_date date)
returns jsonb language sql stable security invoker set search_path='' as $$
 with counts as (select race_no,count(*) n from public.bsc_gamagori_chart_ratings where race_date=p_date group by race_no),
 events as (select e.race_no,coalesce(c.n,0) n,coalesce(e.deadline_time,e.closing_time) deadline
 from public.bs_race_events e left join counts c using(race_no) where e.race_date=p_date and e.course_code=7)
 select jsonb_build_object('race_date',p_date,
 'calendar',(select to_jsonb(d) from public.bsc_gamagori_collection_days d where race_date=p_date),
 'scheduled_races_in_db',(select count(*) from events),
 'expected_races',case when (select calendar_status from public.bsc_gamagori_collection_days where race_date=p_date)='held' then (select count(*) from events) when (select calendar_status from public.bsc_gamagori_collection_days where race_date=p_date)='no_meeting' then 0 else null end,'complete_races',(select count(*) from counts where n=6),
 'missing_due_races',case when (select calendar_status from public.bsc_gamagori_collection_days where race_date=p_date)='held' then (select count(*) from events where n=0 and (p_date<(now() at time zone 'Asia/Tokyo')::date or (deadline is not null and (p_date+deadline) at time zone 'Asia/Tokyo'<=now()))) when (select calendar_status from public.bsc_gamagori_collection_days where race_date=p_date)='no_meeting' then 0 else null end,
 'partial_races',(select count(*) from counts where n<>6),
 'global_saved_boats',(select count(*) from public.bsc_gamagori_chart_ratings),
 'global_saved_races',(select count(distinct(race_date,race_no)) from public.bsc_gamagori_chart_ratings),
 'unknown_deadline_races',(select count(*) from events where deadline is null),
 'saved_boats',(select count(*) from public.bsc_gamagori_chart_ratings where race_date=p_date),
 'last_captured_at',(select max(captured_at) from public.bsc_gamagori_chart_ratings where race_date=p_date),
 'last_captured_at_global',(select max(captured_at) from public.bsc_gamagori_chart_ratings),
 'tasks',coalesce((select jsonb_agg(t order by race_no) from public.bsc_gamagori_collection_tasks t where race_date=p_date),'[]'::jsonb),
 'recent_runs',coalesce((select jsonb_agg(r order by started_at desc) from (select * from public.bsc_gamagori_collection_runs where race_date=p_date order by started_at desc limit 5)r),'[]'::jsonb),
 'stale_running_runs',(select count(*) from public.bsc_gamagori_collection_runs where status='running' and started_at<now()-interval '120 seconds'));
$$;
