-- Keep the elimination-training dataset identical while preferring confirmed
-- official exhibition measurements over legacy/API fallback columns.
create or replace view public.v_elimination_training_entries as
select
  r.race_date,
  r.course_code,
  r.course_name,
  r.race_no,
  r.race_day_no,
  r.race_kind_code,
  r.weather,
  r.wind_direction,
  r.wind_speed,
  r.wave_height,
  r.air_temperature,
  r.water_temperature,
  r.trifecta,
  r.first_boat,
  r.second_boat,
  r.third_boat,
  r.trifecta_payout,
  r.trifecta_popularity,
  r.winning_technique_code,
  e.boat_no,
  e.racer_registration_no,
  e.racer_class,
  coalesce(
    e.gender,
    case
      when e.sex_code = 2 then 'F'::text
      when e.sex_code = 1 then 'M'::text
      else null::text
    end
  ) as gender,
  e.national_win_rate,
  e.local_win_rate,
  e.national_2_rate,
  e.local_2_rate,
  e.average_st,
  e.flying_count,
  coalesce(e.motor_2_rate, e.motor_top2_rate, e.motor_second_rate) as motor_2_rate,
  coalesce(e.boat_2_rate, e.race_boat_top2_rate, e.race_boat_second_rate) as boat_2_rate,
  coalesce(e.official_exhibition_time, e.exhibition_time, e.api_exhibition_time) as exhibition_time,
  coalesce(e.official_exhibition_st, e.exhibition_st, e.api_exhibition_st) as exhibition_st,
  coalesce((e.official_exhibition_course)::integer, e.exhibition_course, (e.api_exhibition_course)::integer) as exhibition_course,
  coalesce(e.official_straight, e.straight_time) as straight_time,
  coalesce(e.official_lap, e.lap_time) as lap_time,
  coalesce(e.official_turn, e.turn_time) as turn_time,
  e.exhibition_time_rank,
  e.start_exhibition_rank,
  case when e.boat_no = r.first_boat then 1 else 0 end as is_first,
  case when e.boat_no = r.second_boat then 1 else 0 end as is_second,
  case when e.boat_no = r.third_boat then 1 else 0 end as is_third,
  case
    when e.boat_no = r.first_boat or e.boat_no = r.second_boat or e.boat_no = r.third_boat then 1
    else 0
  end as is_top3,
  (e.national_win_rate is not null) as has_national_win_rate,
  (e.average_st is not null) as has_average_st,
  (coalesce(e.motor_2_rate, e.motor_top2_rate, e.motor_second_rate) is not null) as has_motor,
  (coalesce(e.official_exhibition_time, e.exhibition_time, e.api_exhibition_time) is not null) as has_exhibition,
  (coalesce(e.official_exhibition_st, e.exhibition_st, e.api_exhibition_st) is not null) as has_exhibition_st,
  (coalesce(e.official_straight, e.straight_time) is not null) as has_straight,
  (coalesce(e.official_lap, e.lap_time) is not null) as has_lap,
  (coalesce(e.official_turn, e.turn_time) is not null) as has_turn
from public.v_elimination_training_races r
join public.bs_race_entries e
  on e.race_date = r.race_date
 and e.course_code = r.course_code
 and e.race_no = r.race_no
where e.boat_no >= 1 and e.boat_no <= 6;
