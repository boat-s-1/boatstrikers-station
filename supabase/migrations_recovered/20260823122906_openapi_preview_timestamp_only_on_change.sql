create or replace function public.bs_apply_openapi_preview(p_rows jsonb, p_synced_at timestamptz default now())
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
$$;