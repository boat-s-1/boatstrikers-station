-- Restore late race results automatically and audit daily data completeness.
-- Production was first repaired with the same objects on 2026-09-20 JST.

do $$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid)
    into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'bs_sync_openapi_today'
    and pg_get_function_identity_arguments(p.oid) = '';

  if v_def is null then
    raise exception 'bs_sync_openapi_today() not found';
  end if;

  if position('time ''22:30''' in v_def) > 0 then
    execute replace(v_def, 'time ''22:30''', 'time ''23:30''');
  elsif position('time ''23:30''' in v_def) = 0 then
    raise exception 'unexpected bs_sync_openapi_today time guard';
  end if;
end
$$;

select cron.alter_job(job_id := 1, schedule := '*/3 23,0-14 * * *');

create or replace function public.bs_backfill_missing_results(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
  v_remaining integer := 0;
begin
  if p_date is null
     or p_date > (now() at time zone 'Asia/Tokyo')::date
     or p_date < date '2024-01-01' then
    raise exception 'invalid backfill date';
  end if;

  with candidates as (
    select
      e.race_date,
      e.course_code,
      e.race_no,
      substring(e.trifecta from 1 for 1)::integer as first_boat,
      substring(e.trifecta from 2 for 1)::integer as second_boat,
      substring(e.trifecta from 3 for 1)::integer as third_boat,
      substring(e.trifecta from 1 for 1) || '-' ||
        substring(e.trifecta from 2 for 1) || '-' ||
        substring(e.trifecta from 3 for 1) as formatted_trifecta,
      e.trifecta_payout,
      e.trifecta_popularity
    from public.bs_race_events e
    left join public.bs_race_results r using (race_date, course_code, race_no)
    where e.race_date = p_date
      and e.result_available = true
      and e.race_cancel_code is null
      and r.id is null
      and e.trifecta ~ '^[1-6]{3}$'
      and e.trifecta_payout is not null
      and (
        select count(*)
        from public.bs_race_entries en
        where en.race_date=e.race_date
          and en.course_code=e.course_code
          and en.race_no=e.race_no
      ) = 6
      and (
        select count(*)
        from public.bs_race_entries en
        where en.race_date=e.race_date
          and en.course_code=e.course_code
          and en.race_no=e.race_no
          and coalesce(en.actual_start_timing,en.actual_st) is not null
      ) = 6
  )
  insert into public.bs_race_results (
    race_date, course_code, race_no,
    trifecta_result, trifecta_payout, result_status, synced_at,
    first_boat, second_boat, third_boat,
    winning_trifecta, trifecta_popularity,
    race_status, api_result_synced_at, api_result_source
  )
  select
    race_date, course_code, race_no,
    formatted_trifecta, trifecta_payout, 'confirmed', now(),
    first_boat, second_boat, third_boat,
    formatted_trifecta, trifecta_popularity,
    'finished', now(), 'event_auto_backfill'
  from candidates
  on conflict (race_date, course_code, race_no) do nothing;

  get diagnostics v_inserted = row_count;

  select count(*)
    into v_remaining
  from public.bs_race_events e
  left join public.bs_race_results r using (race_date, course_code, race_no)
  where e.race_date = p_date
    and e.result_available = true
    and e.race_cancel_code is null
    and r.id is null;

  return jsonb_build_object(
    'ok', v_remaining = 0,
    'race_date', p_date,
    'inserted', v_inserted,
    'remaining', v_remaining,
    'checked_at', now()
  );
end
$$;

revoke all on function public.bs_backfill_missing_results(date) from public, anon, authenticated;
grant execute on function public.bs_backfill_missing_results(date) to postgres, service_role;

create or replace function public.bs_race_data_completeness(p_date date)
returns jsonb
language sql
security definer
set search_path = public
as $$
with race_quality as (
  select
    e.race_date,
    e.course_code,
    e.race_no,
    e.race_cancel_code,
    count(en.id) as entry_rows,
    count(en.id) filter (
      where coalesce(en.official_exhibition_time,en.exhibition_time) is not null
    ) as exhibition_rows,
    count(en.id) filter (
      where coalesce(en.actual_start_timing,en.actual_st) is not null
    ) as start_rows,
    max((r.id is not null)::integer) as has_result,
    max((
      r.id is not null
      and r.trifecta_payout is not null
      and coalesce(r.trifecta_result,r.winning_trifecta) is not null
    )::integer) as has_payout
  from public.bs_race_events e
  left join public.bs_race_entries en using (race_date,course_code,race_no)
  left join public.bs_race_results r using (race_date,course_code,race_no)
  where e.race_date = p_date
  group by e.race_date,e.course_code,e.race_no,e.race_cancel_code
)
select jsonb_build_object(
  'race_date', p_date,
  'races', count(*),
  'entries_complete', count(*) filter (where entry_rows=6),
  'exhibition_complete', count(*) filter (where exhibition_rows=6),
  'results_complete', count(*) filter (
    where race_cancel_code is not null or (has_result=1 and has_payout=1)
  ),
  'result_details_complete', count(*) filter (
    where race_cancel_code is not null or (has_result=1 and start_rows=6)
  ),
  'is_complete', (
    count(*) > 0
    and count(*) = count(*) filter (where entry_rows=6)
    and count(*) = count(*) filter (
      where race_cancel_code is not null or (has_result=1 and has_payout=1)
    )
    and count(*) = count(*) filter (
      where race_cancel_code is not null or (has_result=1 and start_rows=6)
    )
  ),
  'checked_at', now()
)
from race_quality;
$$;

revoke all on function public.bs_race_data_completeness(date) from public, anon, authenticated;
grant execute on function public.bs_race_data_completeness(date) to postgres, service_role;

create or replace function public.bs_record_race_data_completeness(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_detail jsonb;
  v_status text;
begin
  v_detail := public.bs_race_data_completeness(p_date);
  v_status := case when coalesce((v_detail->>'is_complete')::boolean,false)
    then 'success' else 'partial' end;

  insert into public.bs_live_source_sync_logs(
    source,sync_kind,race_date,status,
    entry_rows,event_rows,result_rows,result_entry_rows,
    started_at,finished_at,detail
  )
  values (
    'boatstrikers/completeness-v1','daily_completeness',p_date,v_status,
    (v_detail->>'entries_complete')::integer,
    (v_detail->>'races')::integer,
    (v_detail->>'results_complete')::integer,
    (v_detail->>'result_details_complete')::integer,
    now(),now(),v_detail
  );

  return v_detail;
end
$$;

revoke all on function public.bs_record_race_data_completeness(date) from public, anon, authenticated;
grant execute on function public.bs_record_race_data_completeness(date) to postgres, service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname='boatstrikers-previous-results-0010-jst') then
    perform cron.unschedule('boatstrikers-previous-results-0010-jst');
  end if;
  if exists (select 1 from cron.job where jobname='boatstrikers-previous-results-0030-jst') then
    perform cron.unschedule('boatstrikers-previous-results-0030-jst');
  end if;
  if exists (select 1 from cron.job where jobname='boatstrikers-previous-results-0100-jst') then
    perform cron.unschedule('boatstrikers-previous-results-0100-jst');
  end if;
  if exists (select 1 from cron.job where jobname='boatstrikers-data-completeness-0110-jst') then
    perform cron.unschedule('boatstrikers-data-completeness-0110-jst');
  end if;
end
$$;

select cron.schedule(
  'boatstrikers-previous-results-0010-jst',
  '10 15 * * *',
  $job$select public.bs_backfill_missing_results(((now() at time zone 'Asia/Tokyo')::date - 1));$job$
);
select cron.schedule(
  'boatstrikers-previous-results-0030-jst',
  '30 15 * * *',
  $job$select public.bs_backfill_missing_results(((now() at time zone 'Asia/Tokyo')::date - 1));$job$
);
select cron.schedule(
  'boatstrikers-previous-results-0100-jst',
  '0 16 * * *',
  $job$select public.bs_backfill_missing_results(((now() at time zone 'Asia/Tokyo')::date - 1));$job$
);
select cron.schedule(
  'boatstrikers-data-completeness-0110-jst',
  '10 16 * * *',
  $job$select public.bs_record_race_data_completeness(((now() at time zone 'Asia/Tokyo')::date - 1));$job$
);
