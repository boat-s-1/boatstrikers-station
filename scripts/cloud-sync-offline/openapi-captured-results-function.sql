-- Verbatim read-only production pg_get_functiondef capture, 2026-11-17.
-- DISPOSABLE CI DATABASE ONLY; NEVER APPLY TO PRODUCTION.
CREATE OR REPLACE FUNCTION public.bs_apply_openapi_results(p_results jsonb, p_entries jsonb, p_synced_at timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  set result_available = exists (
        select 1 from public.bs_race_results r
         where r.race_date = e.race_date
           and r.course_code = e.course_code
           and r.race_no = e.race_no
           and r.result_status = 'confirmed'
           and coalesce(r.race_status, 'finished') = 'finished'
      ),
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
$function$
;
