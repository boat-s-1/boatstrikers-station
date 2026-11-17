-- Captured verbatim from production pg_get_functiondef (read-only, 2026-11-17).
-- EXECUTE ONLY IN DISPOSABLE CI POSTGRES; NEVER APPLY TO PRODUCTION.
CREATE OR REPLACE FUNCTION public.bs_apply_openapi_preview(p_rows jsonb, p_synced_at timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_updated integer := 0;
begin
  with payload as (
    select
      (x->>'race_date')::date as race_date,
      (x->>'course_code')::smallint as course_code,
      (x->>'race_no')::smallint as race_no,
      (x->>'boat_no')::smallint as boat_no,
      nullif(x->>'exhibition_time','')::numeric as exhibition_time,
      nullif(x->>'exhibition_st','')::numeric as exhibition_st,
      nullif(x->>'exhibition_course','')::smallint as exhibition_course,
      nullif(x->>'tilt','')::numeric as tilt
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x
  )
  update public.bs_race_entries e
  set
    api_preview_synced_at = case
      when e.api_exhibition_time is distinct from p.exhibition_time
        or e.api_exhibition_st is distinct from p.exhibition_st
        or e.api_exhibition_course is distinct from p.exhibition_course
        or e.api_tilt is distinct from p.tilt
      then p_synced_at
      else e.api_preview_synced_at
    end,
    api_exhibition_time = p.exhibition_time,
    api_exhibition_st = p.exhibition_st,
    api_exhibition_course = p.exhibition_course,
    api_tilt = p.tilt,
    api_preview_source = 'boatraceopenapi/v1',
    exhibition_time = case
      when e.exhibition_source = 'PC-KYOTEI' and e.exhibition_time is not null then e.exhibition_time
      else coalesce(p.exhibition_time, e.exhibition_time)
    end,
    exhibition_st = case
      when e.exhibition_source = 'PC-KYOTEI' and e.exhibition_st is not null then e.exhibition_st
      else coalesce(p.exhibition_st, e.exhibition_st)
    end,
    exhibition_course = case
      when e.exhibition_source = 'PC-KYOTEI' and e.exhibition_course is not null then e.exhibition_course
      else coalesce(p.exhibition_course, e.exhibition_course)
    end,
    tilt = coalesce(e.tilt, p.tilt),
    exhibition_source = case
      when e.exhibition_source = 'PC-KYOTEI' then e.exhibition_source
      when p.exhibition_time is not null or p.exhibition_st is not null or p.exhibition_course is not null then 'BOATRACE_OPEN_API'
      else e.exhibition_source
    end,
    live_synced_at = case
      when e.api_exhibition_time is distinct from p.exhibition_time
        or e.api_exhibition_st is distinct from p.exhibition_st
        or e.api_exhibition_course is distinct from p.exhibition_course
        or e.api_tilt is distinct from p.tilt
      then greatest(coalesce(e.live_synced_at, '-infinity'::timestamptz), p_synced_at)
      else e.live_synced_at
    end,
    updated_at = case
      when e.api_exhibition_time is distinct from p.exhibition_time
        or e.api_exhibition_st is distinct from p.exhibition_st
        or e.api_exhibition_course is distinct from p.exhibition_course
        or e.api_tilt is distinct from p.tilt
      then now()
      else e.updated_at
    end
  from payload p
  where e.race_date = p.race_date
    and e.course_code = p.course_code
    and e.race_no = p.race_no
    and e.boat_no = p.boat_no;

  get diagnostics v_updated = row_count;
  return jsonb_build_object(
    'updated_rows', v_updated,
    'received_rows', jsonb_array_length(coalesce(p_rows, '[]'::jsonb)),
    'synced_at', p_synced_at
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bs_apply_openapi_preview_events(p_rows jsonb, p_synced_at timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;