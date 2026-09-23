-- Emergency bootstrap for days where BRDB cannot create the race skeleton.
-- It inserts only missing races/entries from BOATRACE Open API and never overwrites
-- rows already created by BRDB/PC-KYOTEI.
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
    id,
    race_date,
    course_code,
    race_no,
    course_name,
    race_name,
    deadline_time,
    closing_time,
    distance,
    race_day_no,
    race_status,
    program_available,
    api_synced_at,
    synced_at,
    created_at,
    updated_at
  )
  select
    -1 * (
      to_char(race_date, 'YYYYMMDD')::bigint * 10000
      + course_code::bigint * 100
      + race_no::bigint
    ) as id,
    race_date,
    course_code,
    race_no,
    course_name,
    race_name,
    closing_time,
    closing_time,
    distance,
    race_day_no,
    'scheduled',
    true,
    p_synced_at,
    p_synced_at,
    p_synced_at,
    p_synced_at
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
    id,
    race_date,
    course_code,
    race_no,
    boat_no,
    racer_registration_no,
    racer_name,
    racer_class,
    national_win_rate,
    local_win_rate,
    national_2_rate,
    local_2_rate,
    average_st,
    flying_count,
    late_count,
    motor_no,
    motor_number,
    motor_2_rate,
    motor_top2_rate,
    boat_machine_no,
    race_boat_number,
    boat_2_rate,
    race_boat_top2_rate,
    racer_weight,
    weight,
    data_source,
    api_synced_at,
    synced_at,
    created_at,
    updated_at
  )
  select
    -1 * (
      to_char(race_date, 'YYYYMMDD')::bigint * 100000
      + course_code::bigint * 1000
      + race_no::bigint * 10
      + boat_no::bigint
    ) as id,
    race_date,
    course_code,
    race_no,
    boat_no,
    racer_registration_no,
    racer_name,
    racer_class,
    national_win_rate,
    local_win_rate,
    national_2_rate,
    local_2_rate,
    average_st,
    flying_count,
    late_count,
    motor_no,
    motor_no,
    motor_2_rate,
    motor_2_rate,
    boat_machine_no,
    boat_machine_no,
    boat_2_rate,
    boat_2_rate,
    racer_weight,
    racer_weight,
    'BOATRACE_OPEN_API_BOOTSTRAP',
    p_synced_at,
    p_synced_at,
    p_synced_at,
    p_synced_at
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
