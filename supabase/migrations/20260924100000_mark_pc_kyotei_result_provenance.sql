-- Mark the final adopted result/payout source when the Windows PC-KYOTEI
-- sync successfully writes a race. This is intentionally explicit: the caller
-- must invoke this only after the corresponding PC-KYOTEI write succeeded.

create or replace function public.bs_mark_pc_kyotei_provenance(
  p_race_date date,
  p_course_code smallint,
  p_race_no smallint,
  p_has_result boolean default true,
  p_has_payout boolean default true,
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
  if p_race_date is null
     or p_course_code is null or p_course_code not between 1 and 24
     or p_race_no is null or p_race_no not between 1 and 12 then
    raise exception 'invalid race key';
  end if;

  if not coalesce(p_has_result, false) and not coalesce(p_has_payout, false) then
    return jsonb_build_object(
      'updated_rows', 0,
      'race_date', p_race_date,
      'course_code', p_course_code,
      'race_no', p_race_no,
      'result_marked', false,
      'payout_marked', false,
      'synced_at', p_synced_at
    );
  end if;

  update public.bs_race_events
  set
    result_source = case
      when coalesce(p_has_result, false) then 'PC-KYOTEI'
      else result_source
    end,
    result_synced_at = case
      when coalesce(p_has_result, false) then greatest(coalesce(result_synced_at, '-infinity'::timestamptz), p_synced_at)
      else result_synced_at
    end,
    payout_source = case
      when coalesce(p_has_payout, false) then 'PC-KYOTEI'
      else payout_source
    end,
    payout_synced_at = case
      when coalesce(p_has_payout, false) then greatest(coalesce(payout_synced_at, '-infinity'::timestamptz), p_synced_at)
      else payout_synced_at
    end,
    updated_at = now()
  where race_date = p_race_date
    and course_code = p_course_code
    and race_no = p_race_no;

  get diagnostics v_updated = row_count;

  return jsonb_build_object(
    'updated_rows', v_updated,
    'race_date', p_race_date,
    'course_code', p_course_code,
    'race_no', p_race_no,
    'result_marked', coalesce(p_has_result, false),
    'payout_marked', coalesce(p_has_payout, false),
    'source', 'PC-KYOTEI',
    'synced_at', p_synced_at
  );
end;
$$;

revoke all on function public.bs_mark_pc_kyotei_provenance(date, smallint, smallint, boolean, boolean, timestamptz) from public;
revoke all on function public.bs_mark_pc_kyotei_provenance(date, smallint, smallint, boolean, boolean, timestamptz) from anon;
revoke all on function public.bs_mark_pc_kyotei_provenance(date, smallint, smallint, boolean, boolean, timestamptz) from authenticated;
grant execute on function public.bs_mark_pc_kyotei_provenance(date, smallint, smallint, boolean, boolean, timestamptz) to service_role;
