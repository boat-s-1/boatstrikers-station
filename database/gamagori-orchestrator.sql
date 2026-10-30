-- PHASE 8 additive state only. Chart rows and existing application tables are never updated.
create table public.bsc_gamagori_collection_days (
 race_date date primary key,
 calendar_status text not null default 'unknown' check(calendar_status in ('held','no_meeting','unknown')),
 checked_at timestamptz,
 blocked_until timestamptz
);
create table public.bsc_gamagori_collection_tasks (
 race_date date not null, race_no smallint not null check(race_no between 1 and 12),
 status text not null default 'pending' check(status in ('pending','running','complete','blocked','exhausted','cancelled')),
 attempts integer not null default 0 check(attempts between 0 and 6),
 upstream_attempts integer not null default 0,
 last_attempt_at timestamptz, next_attempt_at timestamptz, last_reason text,
 primary key(race_date,race_no)
);
create table public.bsc_gamagori_collection_runs (
 id uuid primary key, race_date date not null, started_at timestamptz not null default clock_timestamp(),
 finished_at timestamptz,
 status text not null default 'running' check(status in ('running','completed','failed','interrupted')),
 outcome text, results jsonb not null default '[]'::jsonb
);
create index bsc_gamagori_collection_runs_date_started on public.bsc_gamagori_collection_runs(race_date,started_at desc);
alter table public.bsc_gamagori_collection_days enable row level security;
alter table public.bsc_gamagori_collection_tasks enable row level security;
alter table public.bsc_gamagori_collection_runs enable row level security;
revoke all on public.bsc_gamagori_collection_days, public.bsc_gamagori_collection_tasks, public.bsc_gamagori_collection_runs from public,anon,authenticated;
grant select,insert,update on public.bsc_gamagori_collection_days, public.bsc_gamagori_collection_tasks, public.bsc_gamagori_collection_runs to service_role;

create function public.bsc_gamagori_orchestrator_prepare(p_date date,p_run uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 insert into public.bsc_gamagori_collection_runs(id,race_date) values(p_run,p_date);
 update public.bsc_gamagori_collection_runs set status='interrupted',finished_at=clock_timestamp(),outcome='lease_expired'
 where id<>p_run and status='running' and started_at<clock_timestamp()-interval '120 seconds';
 insert into public.bsc_gamagori_collection_days(race_date) values(p_date) on conflict do nothing;
 insert into public.bsc_gamagori_collection_tasks(race_date,race_no)
 select race_date,race_no from public.bs_race_events where race_date=p_date and course_code=7 and race_no between 1 and 12 on conflict do nothing;
 -- A saved full chart is authoritative even when a process died before checkpointing.
 update public.bsc_gamagori_collection_tasks t set status=case
   when (select count(*) from public.bsc_gamagori_chart_ratings c where c.race_date=t.race_date and c.race_no=t.race_no)=6 then 'complete'
   when exists(select 1 from public.bsc_gamagori_chart_ratings c where c.race_date=t.race_date and c.race_no=t.race_no) then 'blocked'
   when t.status='running' and t.next_attempt_at<=clock_timestamp() then case when t.attempts>=6 then 'exhausted' else 'pending' end
   when t.status='complete' then 'pending' else t.status end
 where t.race_date=p_date;
 update public.bsc_gamagori_collection_tasks t set status='cancelled',last_reason='cancellation_flag'
 where t.race_date=p_date and t.status<>'complete' and exists(select 1 from public.bs_race_events e where e.race_date=t.race_date and e.race_no=t.race_no and e.course_code=7 and e.race_cancel_code is not null and e.race_cancel_code not in ('','0'));
 return jsonb_build_object(
 'events',coalesce((select jsonb_agg(jsonb_build_object('race_no',race_no,'deadline_time',coalesce(deadline_time,closing_time),'race_cancel_code',race_cancel_code) order by race_no) from public.bs_race_events where race_date=p_date and course_code=7),'[]'::jsonb),
 'tasks',coalesce((select jsonb_agg(t order by race_no) from public.bsc_gamagori_collection_tasks t where race_date=p_date),'[]'::jsonb),
 'day',(select to_jsonb(d) from public.bsc_gamagori_collection_days d where race_date=p_date));
end $$;

create function public.bsc_gamagori_claim_task(p_date date,p_race smallint,p_owner uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.bsc_gamagori_collector_lease where lock_name='gamagori-chart-collector' and owner=p_owner and lease_until>clock_timestamp() for update;
 if not found then return false; end if;
 if exists(select 1 from public.bsc_gamagori_collection_days where race_date=p_date and blocked_until>clock_timestamp()) then return false; end if;
 update public.bsc_gamagori_collection_tasks set status='running',attempts=attempts+1,
 last_attempt_at=clock_timestamp(),next_attempt_at=clock_timestamp()+interval '120 seconds'
 where race_date=p_date and race_no=p_race and status='pending' and attempts<6
 and (next_attempt_at is null or next_attempt_at<=clock_timestamp());
 return found;
end $$;

create function public.bsc_gamagori_chart_monitor(p_date date)
returns jsonb language sql stable security invoker set search_path='' as $$
 with counts as (select race_no,count(*) n from public.bsc_gamagori_chart_ratings where race_date=p_date group by race_no),
 events as (select e.race_no,coalesce(c.n,0) n,coalesce(e.deadline_time,e.closing_time) deadline, (e.race_cancel_code is not null and e.race_cancel_code not in ('','0')) flagged
 from public.bs_race_events e left join counts c using(race_no) where e.race_date=p_date and e.course_code=7)
 select jsonb_build_object('race_date',p_date,
 'calendar',(select to_jsonb(d) from public.bsc_gamagori_collection_days d where race_date=p_date),
 'scheduled_races_in_db',(select count(*) from events),
 'expected_races',case when (select calendar_status from public.bsc_gamagori_collection_days where race_date=p_date)='held' then (select count(*) from events where not flagged) when (select calendar_status from public.bsc_gamagori_collection_days where race_date=p_date)='no_meeting' then 0 else null end,'complete_races',(select count(*) from counts where n=6),
 'missing_due_races',case when (select calendar_status from public.bsc_gamagori_collection_days where race_date=p_date)='held' then (select count(*) from events where n=0 and not flagged and (p_date<(now() at time zone 'Asia/Tokyo')::date or (deadline is not null and (p_date+deadline) at time zone 'Asia/Tokyo'<=now()))) when (select calendar_status from public.bsc_gamagori_collection_days where race_date=p_date)='no_meeting' then 0 else null end,
 'partial_races',(select count(*) from counts where n<>6),
 'global_saved_boats',(select count(*) from public.bsc_gamagori_chart_ratings),
 'global_saved_races',(select count(distinct(race_date,race_no)) from public.bsc_gamagori_chart_ratings),
 'unknown_deadline_races',(select count(*) from events where deadline is null and not flagged),
 'flagged_races',(select count(*) from events where flagged),
 'saved_boats',(select count(*) from public.bsc_gamagori_chart_ratings where race_date=p_date),
 'last_captured_at',(select max(captured_at) from public.bsc_gamagori_chart_ratings where race_date=p_date),
 'last_captured_at_global',(select max(captured_at) from public.bsc_gamagori_chart_ratings),
 'tasks',coalesce((select jsonb_agg(t order by race_no) from public.bsc_gamagori_collection_tasks t where race_date=p_date),'[]'::jsonb),
 'recent_runs',coalesce((select jsonb_agg(r order by started_at desc) from (select * from public.bsc_gamagori_collection_runs where race_date=p_date order by started_at desc limit 5)r),'[]'::jsonb),
 'stale_running_runs',(select count(*) from public.bsc_gamagori_collection_runs where status='running' and started_at<now()-interval '120 seconds'));
$$;
revoke all on function public.bsc_gamagori_orchestrator_prepare(date,uuid), public.bsc_gamagori_claim_task(date,smallint,uuid), public.bsc_gamagori_chart_monitor(date) from public,anon,authenticated;
grant execute on function public.bsc_gamagori_orchestrator_prepare(date,uuid), public.bsc_gamagori_claim_task(date,smallint,uuid), public.bsc_gamagori_chart_monitor(date) to service_role;
