create or replace function public.ai_v2_normalize_training_rows(p_start date default null, p_end date default null, p_timing text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ai_v2_training_rows
  set
    national_win_rate = case when national_win_rate > 20 then national_win_rate / 100.0 else national_win_rate end,
    local_win_rate    = case when local_win_rate > 20 then local_win_rate / 100.0 else local_win_rate end,
    motor_2_rate      = case when motor_2_rate > 100 then motor_2_rate / 100.0 else motor_2_rate end,
    boat_2_rate       = case when boat_2_rate > 100 then boat_2_rate / 100.0 else boat_2_rate end
  where (p_start is null or race_date >= p_start)
    and (p_end is null or race_date <= p_end)
    and (p_timing is null or data_timing = p_timing);

  with s as (
    select race_date,course_code,race_no,boat_no,data_timing,
      national_win_rate - avg(national_win_rate) over(partition by race_date,course_code,race_no,data_timing) as rn,
      local_win_rate - avg(local_win_rate) over(partition by race_date,course_code,race_no,data_timing) as rl,
      motor_2_rate - avg(motor_2_rate) over(partition by race_date,course_code,race_no,data_timing) as rm,
      rank() over(partition by race_date,course_code,race_no,data_timing order by national_win_rate desc nulls last) as rnk_n,
      rank() over(partition by race_date,course_code,race_no,data_timing order by local_win_rate desc nulls last) as rnk_l,
      rank() over(partition by race_date,course_code,race_no,data_timing order by motor_2_rate desc nulls last) as rnk_m
    from public.ai_v2_training_rows
    where (p_start is null or race_date >= p_start)
      and (p_end is null or race_date <= p_end)
      and (p_timing is null or data_timing = p_timing)
  )
  update public.ai_v2_training_rows t
  set relative_national=s.rn,
      relative_local=s.rl,
      relative_motor=s.rm,
      national_rank_in_race=s.rnk_n,
      local_rank_in_race=s.rnk_l,
      motor_rank_in_race=s.rnk_m
  from s
  where t.race_date=s.race_date and t.course_code=s.course_code and t.race_no=s.race_no and t.boat_no=s.boat_no and t.data_timing=s.data_timing;
end;
$$;