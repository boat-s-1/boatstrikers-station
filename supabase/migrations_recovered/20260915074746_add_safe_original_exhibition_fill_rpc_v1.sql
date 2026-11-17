create or replace function public.bs_fill_original_exhibition_v1(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_requested integer := coalesce(jsonb_array_length(p_rows), 0);
  v_updated integer := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  with incoming as (
    select *
    from jsonb_to_recordset(p_rows) as x(
      race_date date,
      course_code integer,
      race_no integer,
      boat_no integer,
      official_half_lap numeric,
      official_lap numeric,
      official_turn numeric,
      official_straight numeric,
      original_exhibition_source text,
      original_exhibition_synced_at timestamptz
    )
  ),
  changed as (
    update public.bs_race_entries e
       set official_half_lap = coalesce(e.official_half_lap, i.official_half_lap),
           official_lap = coalesce(e.official_lap, i.official_lap),
           official_turn = coalesce(e.official_turn, i.official_turn),
           official_straight = coalesce(e.official_straight, i.official_straight),
           synced_at = now()
      from incoming i
     where e.race_date = i.race_date
       and e.course_code = i.course_code
       and e.race_no = i.race_no
       and e.boat_no = i.boat_no
       and (
         (e.official_half_lap is null and i.official_half_lap is not null)
         or (e.official_lap is null and i.official_lap is not null)
         or (e.official_turn is null and i.official_turn is not null)
         or (e.official_straight is null and i.official_straight is not null)
       )
    returning 1
  )
  select count(*) into v_updated from changed;

  return jsonb_build_object(
    'requested', v_requested,
    'updated', v_updated,
    'unchanged_or_missing', greatest(v_requested - v_updated, 0)
  );
end;
$function$;

revoke all on function public.bs_fill_original_exhibition_v1(jsonb) from public;
grant execute on function public.bs_fill_original_exhibition_v1(jsonb) to service_role;