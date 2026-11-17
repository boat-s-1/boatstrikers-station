alter table public.bs_race_events
  add column if not exists api_preview_synced_at timestamptz,
  add column if not exists api_wind_speed numeric,
  add column if not exists api_wind_direction_code text,
  add column if not exists api_wave_height numeric,
  add column if not exists api_weather_code text,
  add column if not exists api_air_temperature numeric,
  add column if not exists api_water_temperature numeric;

create or replace function public.bs_apply_openapi_preview_events(
  p_rows jsonb,
  p_synced_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
begin
  with payload as (
    select
      (x->>'race_date')::date as race_date,
      (x->>'course_code')::smallint as course_code,
      (x->>'race_no')::smallint as race_no,
      nullif(x->>'wind_speed','')::numeric as wind_speed,
      nullif(x->>'wind_direction_code','')::text as wind_direction_code,
      nullif(x->>'wave_height','')::numeric as wave_height,
      nullif(x->>'weather_code','')::text as weather_code,
      nullif(x->>'air_temperature','')::numeric as air_temperature,
      nullif(x->>'water_temperature','')::numeric as water_temperature
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x
  )
  update public.bs_race_events e
  set
    api_preview_synced_at = p_synced_at,
    api_wind_speed = p.wind_speed,
    api_wind_direction_code = p.wind_direction_code,
    api_wave_height = p.wave_height,
    api_weather_code = p.weather_code,
    api_air_temperature = p.air_temperature,
    api_water_temperature = p.water_temperature,
    wind_speed = coalesce(e.wind_speed, p.wind_speed),
    wind_direction_code = coalesce(e.wind_direction_code, p.wind_direction_code),
    wave_height = coalesce(e.wave_height, p.wave_height),
    weather_code = coalesce(e.weather_code, p.weather_code),
    air_temperature = coalesce(e.air_temperature, p.air_temperature),
    water_temperature = coalesce(e.water_temperature, p.water_temperature),
    updated_at = now()
  from payload p
  where e.race_date = p.race_date
    and e.course_code = p.course_code
    and e.race_no = p.race_no;

  get diagnostics v_updated = row_count;

  return jsonb_build_object(
    'updated_rows', v_updated,
    'received_rows', jsonb_array_length(coalesce(p_rows, '[]'::jsonb)),
    'synced_at', p_synced_at
  );
end;
$$;

revoke all on function public.bs_apply_openapi_preview_events(jsonb, timestamptz) from public;
grant execute on function public.bs_apply_openapi_preview_events(jsonb, timestamptz) to service_role;