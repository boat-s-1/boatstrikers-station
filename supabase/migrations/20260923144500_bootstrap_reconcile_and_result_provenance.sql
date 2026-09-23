-- Track BOATRACE Open API bootstrap recovery without replacing primary keys,
-- and record the source/timestamp of adopted results and payouts.

alter table public.bs_race_events
  add column if not exists data_source text,
  add column if not exists bootstrap_reconciled_at timestamptz,
  add column if not exists result_source text,
  add column if not exists result_synced_at timestamptz,
  add column if not exists payout_source text,
  add column if not exists payout_synced_at timestamptz;

alter table public.bs_race_entries
  add column if not exists bootstrap_reconciled_at timestamptz;

create or replace function public.bs_reconcile_bootstrap_entry()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.data_source = 'BOATRACE_OPEN_API_BOOTSTRAP' then
    -- If a writer explicitly supplies a non-bootstrap source, trust it and only stamp reconciliation.
    if new.data_source is distinct from old.data_source
       and new.data_source is not null
       and new.data_source <> 'BOATRACE_OPEN_API_BOOTSTRAP' then
      new.bootstrap_reconciled_at := coalesce(new.bootstrap_reconciled_at, now());
      return new;
    end if;

    -- These fields are not populated by the emergency OpenAPI bootstrap path.
    -- Seeing one newly populated is a conservative signal that the normal/base feed enriched the row.
    if (old.current_series_results is null and new.current_series_results is not null)
       or (old.racer_name_kana is null and new.racer_name_kana is not null)
       or (old.sex_code is null and new.sex_code is not null)
       or (old.racer_branch is null and new.racer_branch is not null)
       or (old.motor_second_rate is null and new.motor_second_rate is not null)
       or (old.race_boat_second_rate is null and new.race_boat_second_rate is not null) then
      new.data_source := 'BRDB_RECONCILED';
      new.bootstrap_reconciled_at := coalesce(new.bootstrap_reconciled_at, now());
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bs_reconcile_bootstrap_entry on public.bs_race_entries;
create trigger trg_bs_reconcile_bootstrap_entry
before update on public.bs_race_entries
for each row execute function public.bs_reconcile_bootstrap_entry();

create or replace function public.bs_reconcile_bootstrap_event_after_entry()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.data_source = 'BOATRACE_OPEN_API_BOOTSTRAP'
     and new.data_source is distinct from 'BOATRACE_OPEN_API_BOOTSTRAP' then
    update public.bs_race_events e
    set data_source = 'BRDB_RECONCILED',
        bootstrap_reconciled_at = coalesce(e.bootstrap_reconciled_at, now()),
        updated_at = now()
    where e.race_date = new.race_date
      and e.course_code = new.course_code
      and e.race_no = new.race_no
      and e.data_source = 'BOATRACE_OPEN_API_BOOTSTRAP'
      and not exists (
        select 1
        from public.bs_race_entries x
        where x.race_date = new.race_date
          and x.course_code = new.course_code
          and x.race_no = new.race_no
          and x.data_source = 'BOATRACE_OPEN_API_BOOTSTRAP'
      );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bs_reconcile_bootstrap_event_after_entry on public.bs_race_entries;
create trigger trg_bs_reconcile_bootstrap_event_after_entry
after update on public.bs_race_entries
for each row execute function public.bs_reconcile_bootstrap_event_after_entry();

create or replace function public.bs_apply_openapi_bootstrap(
  p_events jsonb,
  p_entries jsonb,
  p_synced_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_inserted integer := 0;
  v_entry_inserted integer := 0;
begin
  with payload as (
    select
      (x->>'race_date')::date as race_date,
      (x->>'course_code')::smallint as course_code,
      (x->>'race_no')::smallint as race_no,
      nullif(x->>'course_name','')::text as course_name,
      nullif(x->>'race_name','')::text as race_name,
      nullif(x->>'closing_time','')::time as closing_time,
      nullif(x->>'distance','')::integer as distance,
      nullif(x->>'race_day_no','')::integer as race_day_no
    from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) x
  )
  insert into public.bs_race_events (
    id, race_date, course_code, race_no, course_name, race_name,
    deadline_time, closing_time, distance, race_day_no, race_status,
    program_available, api_synced_at, data_source,
    synced_at, created_at, updated_at
  )
  select
    -1 * (to_char(race_date, 'YYYYMMDD')::bigint * 10000 + course_code::bigint * 100 + race_no::bigint),
    race_date, course_code, race_no, course_name, race_name,
    closing_time, closing_time, distance, race_day_no, 'scheduled',
    true, p_synced_at, 'BOATRACE_OPEN_API_BOOTSTRAP',
    p_synced_at, p_synced_at, p_synced_at
  from payload
  where race_date is not null
    and course_code between 1 and 24
    and race_no between 1 and 12
  on conflict (race_date, course_code, race_no) do nothing;
  get diagnostics v_event_inserted = row_count;

  with payload as (
    select
      (x->>'race_date')::date as race_date,
      (x->>'course_code')::smallint as course_code,
      (x->>'race_no')::smallint as race_no,
      (x->>'boat_no')::smallint as boat_no,
      nullif(x->>'racer_registration_no','')::text as racer_registration_no,
      nullif(x->>'racer_name','')::text as racer_name,
      nullif(x->>'racer_class','')::text as racer_class,
      nullif(x->>'national_win_rate','')::numeric as national_win_rate,
      nullif(x->>'local_win_rate','')::numeric as local_win_rate,
      nullif(x->>'national_2_rate','')::numeric as national_2_rate,
      nullif(x->>'local_2_rate','')::numeric as local_2_rate,
      nullif(x->>'average_st','')::numeric as average_st,
      nullif(x->>'flying_count','')::smallint as flying_count,
      nullif(x->>'late_count','')::smallint as late_count,
      nullif(x->>'motor_no','')::smallint as motor_no,
      nullif(x->>'motor_2_rate','')::numeric as motor_2_rate,
      nullif(x->>'boat_machine_no','')::smallint as boat_machine_no,
      nullif(x->>'boat_2_rate','')::numeric as boat_2_rate,
      nullif(x->>'racer_weight','')::numeric as racer_weight
    from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) x
  )
  insert into public.bs_race_entries (
    id, race_date, course_code, race_no, boat_no,
    racer_registration_no, racer_name, racer_class,
    national_win_rate, local_win_rate, national_2_rate, local_2_rate,
    average_st, flying_count, late_count,
    motor_no, motor_number, motor_2_rate, motor_top2_rate,
    boat_machine_no, race_boat_number, boat_2_rate, race_boat_top2_rate,
    racer_weight, weight, data_source, api_synced_at,
    synced_at, created_at, updated_at
  )
  select
    -1 * (to_char(race_date, 'YYYYMMDD')::bigint * 100000 + course_code::bigint * 1000 + race_no::bigint * 10 + boat_no::bigint),
    race_date, course_code, race_no, boat_no,
    racer_registration_no, racer_name, racer_class,
    national_win_rate, local_win_rate, national_2_rate, local_2_rate,
    average_st, flying_count, late_count,
    motor_no, motor_no, motor_2_rate, motor_2_rate,
    boat_machine_no, boat_machine_no, boat_2_rate, boat_2_rate,
    racer_weight, racer_weight, 'BOATRACE_OPEN_API_BOOTSTRAP', p_synced_at,
    p_synced_at, p_synced_at, p_synced_at
  from payload
  where race_date is not null
    and course_code between 1 and 24
    and race_no between 1 and 12
    and boat_no between 1 and 6
  on conflict (race_date, course_code, race_no, boat_no) do nothing;
  get diagnostics v_entry_inserted = row_count;

  return jsonb_build_object(
    'event_inserted', v_event_inserted,
    'entry_inserted', v_entry_inserted,
    'received_events', jsonb_array_length(coalesce(p_events, '[]'::jsonb)),
    'received_entries', jsonb_array_length(coalesce(p_entries, '[]'::jsonb)),
    'synced_at', p_synced_at
  );
end;
$$;

revoke all on function public.bs_apply_openapi_bootstrap(jsonb, jsonb, timestamptz) from public;
revoke all on function public.bs_apply_openapi_bootstrap(jsonb, jsonb, timestamptz) from anon;
revoke all on function public.bs_apply_openapi_bootstrap(jsonb, jsonb, timestamptz) from authenticated;
grant execute on function public.bs_apply_openapi_bootstrap(jsonb, jsonb, timestamptz) to service_role;

create or replace function public.bs_apply_openapi_results(
  p_results jsonb,
  p_entries jsonb,
  p_synced_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result_rows integer := 0;
  v_entry_rows integer := 0;
begin
  with payload as (
    select
      (x->>'race_date')::date as race_date,
      (x->>'course_code')::smallint as course_code,
      (x->>'race_no')::smallint as race_no,
      nullif(x->>'winning_method','') as winning_method,
      nullif(x->>'trifecta_result','') as trifecta_result,
      nullif(x->>'trifecta_payout','')::integer as trifecta_payout,
      nullif(x->>'first_boat','')::integer as first_boat,
      nullif(x->>'second_boat','')::integer as second_boat,
      nullif(x->>'third_boat','')::integer as third_boat,
      nullif(x->>'exacta','') as exacta,
      nullif(x->>'exacta_payout','')::integer as exacta_payout,
      nullif(x->>'quinella','') as quinella,
      nullif(x->>'quinella_payout','')::integer as quinella_payout,
      nullif(x->>'trio','') as trio,
      nullif(x->>'trio_payout','')::integer as trio_payout,
      nullif(x->>'technique_code','') as technique_code
    from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) x
  )
  insert into public.bs_race_results (
    race_date, course_code, race_no,
    winning_method, trifecta_result, trifecta_payout,
    result_status, synced_at,
    first_boat, second_boat, third_boat,
    winning_trifecta, winning_technique, race_status,
    api_result_synced_at, api_result_source
  )
  select
    race_date, course_code, race_no,
    winning_method, trifecta_result, trifecta_payout,
    'confirmed', p_synced_at,
    first_boat, second_boat, third_boat,
    trifecta_result, winning_method, 'finished',
    p_synced_at, 'boatraceopenapi/v1'
  from payload
  where trifecta_result is not null or first_boat is not null
  on conflict (race_date, course_code, race_no) do update set
    winning_method = coalesce(excluded.winning_method, bs_race_results.winning_method),
    trifecta_result = coalesce(excluded.trifecta_result, bs_race_results.trifecta_result),
    trifecta_payout = coalesce(excluded.trifecta_payout, bs_race_results.trifecta_payout),
    result_status = coalesce(bs_race_results.result_status, excluded.result_status),
    synced_at = greatest(coalesce(bs_race_results.synced_at, '-infinity'::timestamptz), excluded.synced_at),
    first_boat = coalesce(excluded.first_boat, bs_race_results.first_boat),
    second_boat = coalesce(excluded.second_boat, bs_race_results.second_boat),
    third_boat = coalesce(excluded.third_boat, bs_race_results.third_boat),
    winning_trifecta = coalesce(excluded.winning_trifecta, bs_race_results.winning_trifecta),
    winning_technique = coalesce(excluded.winning_technique, bs_race_results.winning_technique),
    race_status = coalesce(bs_race_results.race_status, excluded.race_status),
    api_result_synced_at = coalesce(bs_race_results.api_result_synced_at, excluded.api_result_synced_at),
    api_result_source = coalesce(bs_race_results.api_result_source, excluded.api_result_source);
  get diagnostics v_result_rows = row_count;

  with payload as (
    select
      (x->>'race_date')::date as race_date,
      (x->>'course_code')::smallint as course_code,
      (x->>'race_no')::smallint as race_no,
      (x->>'boat_no')::smallint as boat_no,
      nullif(x->>'arrival_order','')::integer as arrival_order,
      nullif(x->>'finish_place','') as finish_place,
      nullif(x->>'actual_course','')::integer as actual_course,
      nullif(x->>'actual_st','')::numeric as actual_st,
      nullif(x->>'result_note','') as result_note
    from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) x
  )
  update public.bs_race_entries e
  set arrival_order = coalesce(p.arrival_order, e.arrival_order),
      finish_place = coalesce(p.finish_place, e.finish_place),
      actual_course = coalesce(p.actual_course, e.actual_course),
      actual_start_timing = coalesce(p.actual_st, e.actual_start_timing),
      actual_st = coalesce(p.actual_st, e.actual_st),
      result_note = coalesce(p.result_note, e.result_note),
      api_result_synced_at = coalesce(e.api_result_synced_at, p_synced_at),
      updated_at = now()
  from payload p
  where e.race_date = p.race_date
    and e.course_code = p.course_code
    and e.race_no = p.race_no
    and e.boat_no = p.boat_no;
  get diagnostics v_entry_rows = row_count;

  with payload as (
    select
      (x->>'race_date')::date as race_date,
      (x->>'course_code')::smallint as course_code,
      (x->>'race_no')::smallint as race_no,
      nullif(x->>'trifecta_result','') as trifecta_result,
      nullif(x->>'trifecta_payout','')::integer as trifecta_payout,
      nullif(x->>'exacta','') as exacta,
      nullif(x->>'exacta_payout','')::integer as exacta_payout,
      nullif(x->>'quinella','') as quinella,
      nullif(x->>'quinella_payout','')::integer as quinella_payout,
      nullif(x->>'trio','') as trio,
      nullif(x->>'trio_payout','')::integer as trio_payout,
      nullif(x->>'technique_code','') as technique_code
    from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) x
  )
  update public.bs_race_events e
  set result_available = true,
      trifecta = coalesce(p.trifecta_result, e.trifecta),
      trifecta_payout = coalesce(p.trifecta_payout, e.trifecta_payout),
      exacta = coalesce(p.exacta, e.exacta),
      exacta_payout = coalesce(p.exacta_payout, e.exacta_payout),
      quinella = coalesce(p.quinella, e.quinella),
      quinella_payout = coalesce(p.quinella_payout, e.quinella_payout),
      trio = coalesce(p.trio, e.trio),
      trio_payout = coalesce(p.trio_payout, e.trio_payout),
      winning_technique_code = coalesce(p.technique_code, e.winning_technique_code),
      result_source = case
        when p.trifecta_result is not null or p.technique_code is not null then 'boatraceopenapi/v1'
        else e.result_source
      end,
      result_synced_at = case
        when p.trifecta_result is not null or p.technique_code is not null then p_synced_at
        else e.result_synced_at
      end,
      payout_source = case
        when p.trifecta_payout is not null or p.exacta_payout is not null or p.quinella_payout is not null or p.trio_payout is not null then 'boatraceopenapi/v1'
        else e.payout_source
      end,
      payout_synced_at = case
        when p.trifecta_payout is not null or p.exacta_payout is not null or p.quinella_payout is not null or p.trio_payout is not null then p_synced_at
        else e.payout_synced_at
      end,
      api_synced_at = greatest(coalesce(e.api_synced_at, '-infinity'::timestamptz), p_synced_at),
      updated_at = now()
  from payload p
  where e.race_date = p.race_date
    and e.course_code = p.course_code
    and e.race_no = p.race_no;

  return jsonb_build_object('result_rows', v_result_rows, 'result_entry_rows', v_entry_rows, 'synced_at', p_synced_at);
end;
$$;
