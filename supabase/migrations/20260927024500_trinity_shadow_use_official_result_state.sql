-- Ignore the unreliable aggregate event flag. Closing time plus an actual official result row define whether a prediction is still eligible.\ncreate or replace function public.trinity_shadow_guard() returns trigger language plpgsql set search_path = '' as $$
declare deadline timestamptz;
declare has_result boolean;
declare odds_record record;
declare one_boat jsonb;
declare boat_numbers integer[] := array[]::integer[];
declare source_prediction record;
begin
  if tg_op <> 'INSERT' then
    raise exception 'TRINITY shadow evidence is immutable';
  end if;
  if tg_table_name = 'trinity_prediction_snapshots' then
    select (e.race_date::timestamp + e.closing_time::time) at time zone 'Asia/Tokyo',
      exists (
        select 1 from public.bs_race_results r
        where r.race_date = new.race_date and r.course_code = new.course_code and r.race_no = new.race_no
          and coalesce(r.winning_trifecta, r.trifecta_result) is not null
          and r.trifecta_payout is not null
      )
      into deadline, has_result
    from public.bs_race_events e
    where e.race_date = new.race_date and e.course_code = new.course_code and e.race_no = new.race_no;
    if deadline is null or deadline <= new.generated_at or deadline <= clock_timestamp() or has_result then
      raise exception 'prediction must be generated and inserted before closing and official result availability';
    end if;
    for one_boat in select value from jsonb_array_elements(new.boat_features) loop
      boat_numbers := array_append(boat_numbers, (one_boat->>'boat_no')::integer);
      if one_boat->>'racer_registration_no' is null or one_boat->>'racer_name' is null or
        one_boat->>'average_st' is null or one_boat->>'national_win_rate' is null or
        one_boat->>'local_win_rate' is null or one_boat->>'motor_2_rate' is null or
        one_boat->>'boat_2_rate' is null or one_boat->>'boat_no' is null or
        (one_boat->>'sex_code' is null and one_boat->>'gender' is null and one_boat->>'gender_code' is null) then
        raise exception 'incomplete immutable feature vector';
      end if;
      if new.timing = 'previous_day' and (one_boat ? 'exhibition_time' or one_boat ? 'exhibition_st' or
         one_boat ? 'lap_time' or one_boat ? 'turn_time' or one_boat ? 'straight_time' or one_boat ? 'exhibition_course') then
        raise exception 'previous_day cannot carry exhibition features';
      end if;
      if new.timing = 'after_exhibition' and (one_boat->>'exhibition_time' is null or one_boat->>'exhibition_st' is null) then
        raise exception 'after_exhibition requires six observed exhibition records';
      end if;
    end loop;
    if (select array_agg(v order by v) from unnest(boat_numbers) v) <> array[1,2,3,4,5,6] then
      raise exception 'feature vectors must contain boat numbers 1 through 6 exactly once';
    end if;
    if new.odds_snapshot_id is not null then
      select o.race_date, o.course_code, o.race_no, o.captured_at into odds_record
      from public.bs_elimination_odds_snapshots o where o.id = new.odds_snapshot_id;
      if odds_record.race_date is distinct from new.race_date or odds_record.course_code is distinct from new.course_code or
        odds_record.race_no is distinct from new.race_no or odds_record.captured_at is distinct from new.odds_captured_at or
        odds_record.captured_at > new.source_captured_at then
        raise exception 'odds source must be historical and belong to this race';
      end if;
    end if;
  else
    select s.race_date, s.course_code, s.race_no, s.generated_at into source_prediction
      from public.trinity_prediction_snapshots s where s.prediction_id = new.prediction_id;
    if source_prediction.race_date is distinct from new.race_date or
       source_prediction.course_code is distinct from new.course_code or
       source_prediction.race_no is distinct from new.race_no or
       source_prediction.generated_at >= new.settled_at then
      raise exception 'settlement must match a prior prediction';
    end if;
    if not exists (select 1 from public.bs_race_results r where r.race_date = new.race_date
       and r.course_code = new.course_code and r.race_no = new.race_no
       and regexp_replace(coalesce(r.winning_trifecta, r.trifecta_result, ''), '[^1-6]', '', 'g') =
           regexp_replace(new.actual_trifecta, '[^1-6]', '', 'g')
       and r.trifecta_payout = new.trifecta_payout) then
      raise exception 'settlement requires a matching recorded official result';
    end if;
  end if;
  return new;
end;
$$;\n