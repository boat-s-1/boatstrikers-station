create or replace view public.v_elimination_training_races as
with source as (
  select
    ev.*,
    br.trifecta_result,
    br.trifecta_payout as result_trifecta_payout,
    regexp_replace(coalesce(ev.trifecta, br.trifecta_result), '[^1-6]', '', 'g') as trifecta_digits
  from public.bs_race_events ev
  left join public.bs_race_results br
    on br.race_date = ev.race_date
   and br.course_code = ev.course_code
   and br.race_no = ev.race_no
), normalized as (
  select
    *,
    substring(trifecta_digits from 1 for 1)::smallint as parsed_first,
    substring(trifecta_digits from 2 for 1)::smallint as parsed_second,
    substring(trifecta_digits from 3 for 1)::smallint as parsed_third
  from source
  where length(trifecta_digits) = 3
)
select
  race_date,
  course_code,
  course_name,
  race_no,
  race_day_no,
  race_kind_code,
  weather,
  wind_direction,
  wind_speed,
  wave_height,
  air_temperature,
  water_temperature,
  concat(parsed_first, '-', parsed_second, '-', parsed_third) as trifecta,
  parsed_first as first_boat,
  parsed_second as second_boat,
  parsed_third as third_boat,
  coalesce(trifecta_payout, result_trifecta_payout) as trifecta_payout,
  trifecta_popularity,
  winning_technique_code,
  result_available,
  race_cancel_code
from normalized
where parsed_first between 1 and 6
  and parsed_second between 1 and 6
  and parsed_third between 1 and 6
  and parsed_first <> parsed_second
  and parsed_first <> parsed_third
  and parsed_second <> parsed_third;