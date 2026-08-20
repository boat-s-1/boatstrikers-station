-- PostgreSQL cannot update rows in the same SQL statement that were modified
-- by the base refresh function. Run refresh and label normalization sequentially.

create or replace function public.ai_v2_refresh_training_rows(
  p_start_date date,
  p_end_date date,
  p_data_timing text default 'previous_day'
)
returns table (
  deleted_rows bigint,
  inserted_rows bigint,
  race_count bigint
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_deleted bigint;
  v_inserted bigint;
  v_races bigint;
begin
  select r.deleted_rows, r.inserted_rows, r.race_count
    into v_deleted, v_inserted, v_races
  from public.ai_v2_refresh_training_rows_base(
    p_start_date,
    p_end_date,
    p_data_timing
  ) r;

  update public.ai_v2_training_rows tr
     set ichika_target = case
       when tr.finish_position = 1
        and regexp_replace(
              coalesce(rr.winning_method, rr.winning_technique, ''),
              '[[:space:]　]+',
              '',
              'g'
            ) = '逃げ'
         then 1
       else 0
     end,
     updated_at = now()
    from public.bs_race_results rr
   where tr.race_date between p_start_date and p_end_date
     and tr.data_timing = p_data_timing
     and tr.boat_no = 1
     and rr.race_date = tr.race_date
     and rr.course_code = tr.course_code
     and rr.race_no = tr.race_no;

  return query select v_deleted, v_inserted, v_races;
end;
$$;
