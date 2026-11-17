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
    api_result_synced_at = case
      when bs_race_results.api_result_synced_at is null then excluded.api_result_synced_at
      else bs_race_results.api_result_synced_at
    end,
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
  set
    arrival_order = coalesce(p.arrival_order, e.arrival_order),
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
  set
    result_available = true,
    trifecta = coalesce(p.trifecta_result, e.trifecta),
    trifecta_payout = coalesce(p.trifecta_payout, e.trifecta_payout),
    exacta = coalesce(p.exacta, e.exacta),
    exacta_payout = coalesce(p.exacta_payout, e.exacta_payout),
    quinella = coalesce(p.quinella, e.quinella),
    quinella_payout = coalesce(p.quinella_payout, e.quinella_payout),
    trio = coalesce(p.trio, e.trio),
    trio_payout = coalesce(p.trio_payout, e.trio_payout),
    winning_technique_code = coalesce(p.technique_code, e.winning_technique_code),
    api_synced_at = greatest(coalesce(e.api_synced_at, '-infinity'::timestamptz), p_synced_at),
    updated_at = now()
  from payload p
  where e.race_date = p.race_date
    and e.course_code = p.course_code
    and e.race_no = p.race_no;

  return jsonb_build_object(
    'result_rows', v_result_rows,
    'result_entry_rows', v_entry_rows,
    'synced_at', p_synced_at
  );
end;
$$;

create or replace function public.bs_sync_openapi_today()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_now timestamptz := now();
  v_jst timestamp := now() at time zone 'Asia/Tokyo';
  v_date date := (now() at time zone 'Asia/Tokyo')::date;
  v_started timestamptz := now();
  v_log_id bigint;
  v_response extensions.http_response;
  v_json jsonb;
  v_entry_rows jsonb := '[]'::jsonb;
  v_event_rows jsonb := '[]'::jsonb;
  v_result_rows jsonb := '[]'::jsonb;
  v_result_entry_rows jsonb := '[]'::jsonb;
  v_preview_result jsonb;
  v_event_result jsonb;
  v_results_result jsonb;
  v_detail jsonb;
begin
  if v_jst::time < time '07:00' or v_jst::time > time '22:30' then
    return jsonb_build_object('ok', true, 'skipped', true, 'reason', 'outside_jst_window', 'jst', v_jst);
  end if;

  insert into public.bs_live_source_sync_logs(source, sync_kind, race_date, status, started_at)
  values ('boatraceopenapi/v1', 'live_all', v_date, 'running', v_started)
  returning id into v_log_id;

  v_response := extensions.http_get('https://boatraceopenapi.github.io/api/v1/today.json');
  if v_response.status <> 200 then
    raise exception 'OpenAPI HTTP status %', v_response.status;
  end if;
  v_json := v_response.content::jsonb;

  with stadiums as (
    select s.key as stadium_key, s.value as stadium
    from jsonb_each(coalesce(v_json #> '{programs,stadiums}', '{}'::jsonb)) s
  ), races as (
    select
      coalesce(nullif(stadium->>'stadium_number','')::integer, stadium_key::integer) as course_code,
      r.key as race_key,
      r.value as race
    from stadiums
    cross join lateral jsonb_each(coalesce(stadium->'races', '{}'::jsonb)) r
  ), previews as (
    select
      course_code,
      coalesce(nullif(race->>'race_number','')::integer, race_key::integer) as race_no,
      coalesce(nullif(race->>'date','')::date, v_date) as race_date,
      race->'preview' as preview
    from races
    where race->'preview' is not null
      and jsonb_typeof(race->'preview') = 'object'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'race_date', race_date,
    'course_code', course_code,
    'race_no', race_no,
    'wind_speed', nullif(preview->>'wind_speed','')::numeric,
    'wind_direction_code', preview->>'wind_direction_number',
    'wave_height', nullif(preview->>'wave_height','')::numeric,
    'weather_code', preview->>'weather_number',
    'air_temperature', nullif(preview->>'air_temperature','')::numeric,
    'water_temperature', nullif(preview->>'water_temperature','')::numeric
  )), '[]'::jsonb)
  into v_event_rows
  from previews;

  with stadiums as (
    select s.key as stadium_key, s.value as stadium
    from jsonb_each(coalesce(v_json #> '{programs,stadiums}', '{}'::jsonb)) s
  ), races as (
    select
      coalesce(nullif(stadium->>'stadium_number','')::integer, stadium_key::integer) as course_code,
      r.key as race_key,
      r.value as race
    from stadiums
    cross join lateral jsonb_each(coalesce(stadium->'races', '{}'::jsonb)) r
  ), previews as (
    select
      course_code,
      coalesce(nullif(race->>'race_number','')::integer, race_key::integer) as race_no,
      coalesce(nullif(race->>'date','')::date, v_date) as race_date,
      race->'preview' as preview
    from races
    where race->'preview' is not null
      and jsonb_typeof(race->'preview') = 'object'
  ), racers as (
    select p.*, rr.key as boat_key, rr.value as racer
    from previews p
    cross join lateral jsonb_each(coalesce(p.preview->'racers', '{}'::jsonb)) rr
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'race_date', race_date,
    'course_code', course_code,
    'race_no', race_no,
    'boat_no', coalesce(nullif(racer->>'entry_number','')::integer, boat_key::integer),
    'exhibition_time', nullif(racer->>'exhibition_time','')::numeric,
    'exhibition_st', nullif(racer->>'start_timing','')::numeric,
    'exhibition_course', nullif(racer->>'course_number','')::integer,
    'tilt', nullif(racer->>'tilt_adjustment','')::numeric
  )) filter (where
    racer->>'exhibition_time' is not null or
    racer->>'start_timing' is not null or
    racer->>'course_number' is not null or
    racer->>'tilt_adjustment' is not null
  ), '[]'::jsonb)
  into v_entry_rows
  from racers;

  with stadiums as (
    select s.key as stadium_key, s.value as stadium
    from jsonb_each(coalesce(v_json #> '{programs,stadiums}', '{}'::jsonb)) s
  ), races as (
    select
      coalesce(nullif(stadium->>'stadium_number','')::integer, stadium_key::integer) as course_code,
      r.key as race_key,
      r.value as race
    from stadiums
    cross join lateral jsonb_each(coalesce(stadium->'races', '{}'::jsonb)) r
  ), completed as (
    select
      course_code,
      coalesce(nullif(race->>'race_number','')::integer, race_key::integer) as race_no,
      coalesce(nullif(race->>'date','')::date, v_date) as race_date,
      race->'result' as result
    from races
    where race->'result' is not null
      and jsonb_typeof(race->'result') = 'object'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'race_date', race_date,
    'course_code', course_code,
    'race_no', race_no,
    'winning_method', result->>'technique_number_source',
    'technique_code', result->>'technique_number',
    'trifecta_result', result #>> '{payouts,trifecta,0,combination}',
    'trifecta_payout', result #>> '{payouts,trifecta,0,amount}',
    'exacta', result #>> '{payouts,exacta,0,combination}',
    'exacta_payout', result #>> '{payouts,exacta,0,amount}',
    'quinella', result #>> '{payouts,quinella,0,combination}',
    'quinella_payout', result #>> '{payouts,quinella,0,amount}',
    'trio', result #>> '{payouts,trio,0,combination}',
    'trio_payout', result #>> '{payouts,trio,0,amount}',
    'first_boat', (select (x.value->>'entry_number')::integer from jsonb_each(coalesce(result->'racers','{}'::jsonb)) x where x.value->>'place_number' = '1' limit 1),
    'second_boat', (select (x.value->>'entry_number')::integer from jsonb_each(coalesce(result->'racers','{}'::jsonb)) x where x.value->>'place_number' = '2' limit 1),
    'third_boat', (select (x.value->>'entry_number')::integer from jsonb_each(coalesce(result->'racers','{}'::jsonb)) x where x.value->>'place_number' = '3' limit 1)
  )), '[]'::jsonb)
  into v_result_rows
  from completed;

  with stadiums as (
    select s.key as stadium_key, s.value as stadium
    from jsonb_each(coalesce(v_json #> '{programs,stadiums}', '{}'::jsonb)) s
  ), races as (
    select
      coalesce(nullif(stadium->>'stadium_number','')::integer, stadium_key::integer) as course_code,
      r.key as race_key,
      r.value as race
    from stadiums
    cross join lateral jsonb_each(coalesce(stadium->'races', '{}'::jsonb)) r
  ), completed as (
    select
      course_code,
      coalesce(nullif(race->>'race_number','')::integer, race_key::integer) as race_no,
      coalesce(nullif(race->>'date','')::date, v_date) as race_date,
      race->'result' as result
    from races
    where race->'result' is not null
      and jsonb_typeof(race->'result') = 'object'
  ), racers as (
    select c.*, rr.key as boat_key, rr.value as racer
    from completed c
    cross join lateral jsonb_each(coalesce(c.result->'racers', '{}'::jsonb)) rr
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'race_date', race_date,
    'course_code', course_code,
    'race_no', race_no,
    'boat_no', coalesce(nullif(racer->>'entry_number','')::integer, boat_key::integer),
    'arrival_order', case when nullif(racer->>'place_number','')::integer between 1 and 6 then (racer->>'place_number')::integer else null end,
    'finish_place', racer->>'place_number_source',
    'actual_course', nullif(racer->>'course_number','')::integer,
    'actual_st', nullif(racer->>'start_timing','')::numeric,
    'result_note', result->>'remarks'
  )), '[]'::jsonb)
  into v_result_entry_rows
  from racers;

  v_preview_result := public.bs_apply_openapi_preview(v_entry_rows, v_now);
  v_event_result := public.bs_apply_openapi_preview_events(v_event_rows, v_now);
  v_results_result := public.bs_apply_openapi_results(v_result_rows, v_result_entry_rows, v_now);

  v_detail := jsonb_build_object(
    'preview', v_preview_result,
    'events', v_event_result,
    'results', v_results_result,
    'api_entry_rows', jsonb_array_length(v_entry_rows),
    'api_event_rows', jsonb_array_length(v_event_rows),
    'api_result_rows', jsonb_array_length(v_result_rows),
    'api_result_entry_rows', jsonb_array_length(v_result_entry_rows)
  );

  update public.bs_live_source_sync_logs
  set status = 'success',
      entry_rows = jsonb_array_length(v_entry_rows),
      event_rows = jsonb_array_length(v_event_rows),
      result_rows = jsonb_array_length(v_result_rows),
      result_entry_rows = jsonb_array_length(v_result_entry_rows),
      finished_at = now(),
      detail = v_detail
  where id = v_log_id;

  return jsonb_build_object('ok', true, 'date', v_date, 'detail', v_detail);
exception when others then
  if v_log_id is not null then
    update public.bs_live_source_sync_logs
    set status = 'error', finished_at = now(), detail = jsonb_build_object('error', sqlerrm)
    where id = v_log_id;
  end if;
  raise;
end;
$$;