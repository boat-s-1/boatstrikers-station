-- AI v2 historical recovery: use race-level trifecta_result for 1st/2nd/3rd labels.
-- This salvages historical races where bs_race_result_entries has no finish_position.

create or replace function public.ai_v2_refresh_training_rows(
  p_start_date date,
  p_end_date date,
  p_data_timing text default 'previous_day'
)
returns table (deleted_rows bigint, inserted_rows bigint, race_count bigint)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_deleted bigint := 0;
  v_inserted bigint := 0;
  v_races bigint := 0;
begin
  if p_start_date is null or p_end_date is null then
    raise exception 'start_date and end_date are required';
  end if;
  if p_start_date > p_end_date then
    raise exception 'start_date must be <= end_date';
  end if;
  if p_data_timing not in ('previous_day','after_exhibition') then
    raise exception 'data_timing must be previous_day or after_exhibition';
  end if;

  delete from public.ai_v2_training_rows
  where race_date between p_start_date and p_end_date
    and data_timing = p_data_timing;
  get diagnostics v_deleted = row_count;

  with result_base as (
    select
      rr.*,
      coalesce(nullif(trim(rr.trifecta_result),''), nullif(trim(rr.winning_trifecta),'')) as trifecta_text
    from public.bs_race_results rr
    where rr.race_date between p_start_date and p_end_date
  ),
  parsed_results as (
    select
      r.*,
      split_part(r.trifecta_text,'-',1)::smallint as first_boat,
      split_part(r.trifecta_text,'-',2)::smallint as second_boat,
      split_part(r.trifecta_text,'-',3)::smallint as third_boat,
      trim(coalesce(r.winning_method, r.winning_technique, '')) as winning_method_text
    from result_base r
    where r.trifecta_text ~ '^[1-6]-[1-6]-[1-6]$'
  ),
  raw_entries as (
    select
      e.race_date,
      e.course_code,
      e.race_no,
      e.boat_no,
      ev.race_day_no,
      ev.wind_speed,
      ev.wave_height,
      e.racer_registration_no,
      e.racer_class,
      e.class,
      e.gender,
      e.gender_code,
      e.sex_code,
      e.national_win_rate,
      coalesce(e.national_top2_rate, e.national_2_rate) as national_2_rate,
      e.local_win_rate,
      coalesce(e.local_top2_rate, e.local_2_rate) as local_2_rate,
      e.average_st,
      coalesce(e.motor_top2_rate, e.motor_2_rate, e.motor_second_rate) as motor_2_rate,
      coalesce(e.race_boat_top2_rate, e.boat_2_rate, e.race_boat_second_rate) as boat_2_rate,
      e.flying_count,
      e.late_count,
      e.course1_average_st,
      coalesce(e.course1_top2_rate, e.course1_2_rate) as course1_top2_rate,
      coalesce(e.course1_race_count, e.course1_races) as course1_race_count,
      coalesce(e.official_exhibition_time, e.exhibition_time) as exhibition_time,
      coalesce(e.exhibition_time_rank, e.start_exhibition_rank) as exhibition_rank,
      coalesce(e.official_exhibition_st, e.exhibition_st) as exhibition_st,
      coalesce(e.official_exhibition_course, e.exhibition_course) as exhibition_course,
      coalesce(e.official_half_lap, e.half_lap_time) as half_lap_time,
      coalesce(e.official_lap, e.lap_time) as lap_time,
      coalesce(e.official_turn, e.turn_time) as turn_time,
      coalesce(e.official_straight, e.straight_time) as straight_time,
      coalesce(e.official_tilt, e.tilt) as tilt,
      pr.first_boat,
      pr.second_boat,
      pr.third_boat,
      pr.winning_method_text,
      coalesce(
        rgm.racer_gender,
        case
          when upper(trim(coalesce(e.gender,''))) in ('F','FEMALE','女','女子') then 'F'
          when upper(trim(coalesce(e.gender,''))) in ('M','MALE','男','男子') then 'M'
          when trim(coalesce(e.gender_code,'')) = '2' then 'F'
          when trim(coalesce(e.gender_code,'')) = '1' then 'M'
          when e.sex_code = 2 then 'F'
          when e.sex_code = 1 then 'M'
          else null
        end
      ) as normalized_gender
    from public.bs_race_entries e
    join public.bs_race_events ev
      on ev.race_date=e.race_date and ev.course_code=e.course_code and ev.race_no=e.race_no
    join parsed_results pr
      on pr.race_date=e.race_date and pr.course_code=e.course_code and pr.race_no=e.race_no
    left join public.racer_gender_master rgm
      on e.racer_registration_no ~ '^[0-9]+$'
     and rgm.racer_id=e.racer_registration_no::integer
    where e.race_date between p_start_date and p_end_date
      and pr.first_boat <> pr.second_boat
      and pr.first_boat <> pr.third_boat
      and pr.second_boat <> pr.third_boat
  ),
  race_quality as (
    select
      race_date, course_code, race_no,
      count(*) as entry_count,
      count(*) filter(where exhibition_time is not null) as exhibition_count,
      count(*) filter(where normalized_gender='F') as female_count,
      count(*) filter(where normalized_gender is not null) as known_gender_count
    from raw_entries
    group by race_date, course_code, race_no
    having count(*)=6
  ),
  eligible as (
    select r.*,
      (q.female_count=6 and q.known_gender_count=6) as is_female_race
    from raw_entries r
    join race_quality q using (race_date,course_code,race_no)
    where p_data_timing='previous_day'
       or (p_data_timing='after_exhibition' and q.exhibition_count=6)
  ),
  features as (
    select
      e.*,
      avg(e.national_win_rate) over w as avg_national,
      avg(e.local_win_rate) over w as avg_local,
      avg(e.motor_2_rate) over w as avg_motor,
      avg(e.average_st) over w as avg_st,
      rank() over (w order by e.national_win_rate desc nulls last) as national_rank,
      rank() over (w order by e.local_win_rate desc nulls last) as local_rank,
      rank() over (w order by e.motor_2_rate desc nulls last) as motor_rank,
      rank() over (w order by e.average_st asc nulls last) as st_rank
    from eligible e
    window w as (partition by e.race_date,e.course_code,e.race_no)
  ),
  inserted as (
    insert into public.ai_v2_training_rows (
      race_date,course_code,race_no,boat_no,data_timing,feature_version,source_mode,captured_at,
      race_day_no,is_female_race,racer_class,national_win_rate,national_2_rate,local_win_rate,local_2_rate,
      average_st,motor_2_rate,boat_2_rate,flying_count,late_count,course1_average_st,course1_top2_rate,course1_race_count,
      relative_national,relative_local,relative_motor,relative_st,national_rank_in_race,local_rank_in_race,motor_rank_in_race,st_rank_in_race,
      exhibition_time,exhibition_rank,exhibition_st,exhibition_course,half_lap_time,lap_time,turn_time,straight_time,tilt,wind_speed,wave_height,
      finish_position,is_first,is_second,is_third,ichika_target,hatsune_target,kiina_target,feature_snapshot
    )
    select
      f.race_date,f.course_code,f.race_no,f.boat_no,p_data_timing,'ai-v2-feature-v1','historical_reconstructed',null,
      f.race_day_no,f.is_female_race,coalesce(f.class,f.racer_class),f.national_win_rate,f.national_2_rate,f.local_win_rate,f.local_2_rate,
      f.average_st,f.motor_2_rate,f.boat_2_rate,f.flying_count,f.late_count,f.course1_average_st,f.course1_top2_rate,f.course1_race_count,
      f.national_win_rate-f.avg_national,
      f.local_win_rate-f.avg_local,
      f.motor_2_rate-f.avg_motor,
      case when f.average_st is null or f.avg_st is null then null else f.avg_st-f.average_st end,
      f.national_rank::smallint,f.local_rank::smallint,f.motor_rank::smallint,f.st_rank::smallint,
      case when p_data_timing='after_exhibition' then f.exhibition_time end,
      case when p_data_timing='after_exhibition' then f.exhibition_rank end,
      case when p_data_timing='after_exhibition' then f.exhibition_st end,
      case when p_data_timing='after_exhibition' then f.exhibition_course end,
      case when p_data_timing='after_exhibition' then f.half_lap_time end,
      case when p_data_timing='after_exhibition' then f.lap_time end,
      case when p_data_timing='after_exhibition' then f.turn_time end,
      case when p_data_timing='after_exhibition' then f.straight_time end,
      case when p_data_timing='after_exhibition' then f.tilt end,
      case when p_data_timing='after_exhibition' then f.wind_speed end,
      case when p_data_timing='after_exhibition' then f.wave_height end,
      case when f.boat_no=f.first_boat then 1 when f.boat_no=f.second_boat then 2 when f.boat_no=f.third_boat then 3 else null end,
      f.boat_no=f.first_boat,
      f.boat_no=f.second_boat,
      f.boat_no=f.third_boat,
      case when f.boat_no=1 then case when f.first_boat=1 and regexp_replace(f.winning_method_text,'[[:space:]　]+','','g')='逃げ' then 1 else 0 end end,
      case when f.boat_no=1 and f.is_female_race then case when f.first_boat=1 then 1 else 0 end end,
      case when f.boat_no=5 then case when f.first_boat=5 then 1 else 0 end end,
      jsonb_strip_nulls(jsonb_build_object(
        'race_day_no',f.race_day_no,'is_female_race',f.is_female_race,'racer_class',coalesce(f.class,f.racer_class),
        'national_win_rate',f.national_win_rate,'national_2_rate',f.national_2_rate,'local_win_rate',f.local_win_rate,'local_2_rate',f.local_2_rate,
        'average_st',f.average_st,'motor_2_rate',f.motor_2_rate,'boat_2_rate',f.boat_2_rate,'flying_count',f.flying_count,'late_count',f.late_count,
        'course1_average_st',f.course1_average_st,'course1_top2_rate',f.course1_top2_rate,'course1_race_count',f.course1_race_count,
        'relative_national',f.national_win_rate-f.avg_national,'relative_local',f.local_win_rate-f.avg_local,'relative_motor',f.motor_2_rate-f.avg_motor,
        'relative_st',case when f.average_st is null or f.avg_st is null then null else f.avg_st-f.average_st end,
        'national_rank_in_race',f.national_rank,'local_rank_in_race',f.local_rank,'motor_rank_in_race',f.motor_rank,'st_rank_in_race',f.st_rank,
        'exhibition_time',case when p_data_timing='after_exhibition' then f.exhibition_time end,
        'exhibition_rank',case when p_data_timing='after_exhibition' then f.exhibition_rank end,
        'exhibition_st',case when p_data_timing='after_exhibition' then f.exhibition_st end,
        'exhibition_course',case when p_data_timing='after_exhibition' then f.exhibition_course end,
        'half_lap_time',case when p_data_timing='after_exhibition' then f.half_lap_time end,
        'lap_time',case when p_data_timing='after_exhibition' then f.lap_time end,
        'turn_time',case when p_data_timing='after_exhibition' then f.turn_time end,
        'straight_time',case when p_data_timing='after_exhibition' then f.straight_time end,
        'tilt',case when p_data_timing='after_exhibition' then f.tilt end,
        'wind_speed',case when p_data_timing='after_exhibition' then f.wind_speed end,
        'wave_height',case when p_data_timing='after_exhibition' then f.wave_height end
      ))
    from features f
    on conflict (race_date,course_code,race_no,boat_no,data_timing)
    do update set
      feature_version=excluded.feature_version,source_mode=excluded.source_mode,race_day_no=excluded.race_day_no,
      is_female_race=excluded.is_female_race,racer_class=excluded.racer_class,national_win_rate=excluded.national_win_rate,
      national_2_rate=excluded.national_2_rate,local_win_rate=excluded.local_win_rate,local_2_rate=excluded.local_2_rate,
      average_st=excluded.average_st,motor_2_rate=excluded.motor_2_rate,boat_2_rate=excluded.boat_2_rate,
      flying_count=excluded.flying_count,late_count=excluded.late_count,course1_average_st=excluded.course1_average_st,
      course1_top2_rate=excluded.course1_top2_rate,course1_race_count=excluded.course1_race_count,
      relative_national=excluded.relative_national,relative_local=excluded.relative_local,relative_motor=excluded.relative_motor,relative_st=excluded.relative_st,
      national_rank_in_race=excluded.national_rank_in_race,local_rank_in_race=excluded.local_rank_in_race,motor_rank_in_race=excluded.motor_rank_in_race,st_rank_in_race=excluded.st_rank_in_race,
      exhibition_time=excluded.exhibition_time,exhibition_rank=excluded.exhibition_rank,exhibition_st=excluded.exhibition_st,exhibition_course=excluded.exhibition_course,
      half_lap_time=excluded.half_lap_time,lap_time=excluded.lap_time,turn_time=excluded.turn_time,straight_time=excluded.straight_time,tilt=excluded.tilt,
      wind_speed=excluded.wind_speed,wave_height=excluded.wave_height,finish_position=excluded.finish_position,is_first=excluded.is_first,is_second=excluded.is_second,is_third=excluded.is_third,
      ichika_target=excluded.ichika_target,hatsune_target=excluded.hatsune_target,kiina_target=excluded.kiina_target,
      feature_snapshot=excluded.feature_snapshot,updated_at=now()
    returning race_date,course_code,race_no
  )
  select count(*),count(distinct (race_date,course_code,race_no)) into v_inserted,v_races from inserted;

  return query select v_deleted,v_inserted,v_races;
end;
$$;

comment on function public.ai_v2_refresh_training_rows(date,date,text) is
  'Rebuilds AI v2 training rows using race-level trifecta_result as reliable top-3 labels when historical per-boat finish positions are absent.';
