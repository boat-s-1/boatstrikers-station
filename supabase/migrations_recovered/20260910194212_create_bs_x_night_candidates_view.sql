create or replace view public.v_bs_x_night_candidates
with (security_invoker = true)
as
with confirmed as (
  select
    r.*,
    nullif(substring(regexp_replace(coalesce(r.trifecta,''), '[^1-6]', '', 'g') from 1 for 1),'')::smallint as first_boat,
    nullif(substring(regexp_replace(coalesce(r.trifecta,''), '[^1-6]', '', 'g') from 2 for 1),'')::smallint as second_boat,
    nullif(substring(regexp_replace(coalesce(r.trifecta,''), '[^1-6]', '', 'g') from 3 for 1),'')::smallint as third_boat
  from public.v_bs_race_results_confirmed r
  where r.effective_result_available = true
    and r.result_confirmation_reason in ('source_result_available','complete_result_payload_after_close')
), female_counts as (
  select race_date, course_code, race_no,
         count(*) filter (where gender_code = '2')::integer as female_entry_count
  from public.bs_race_entries
  group by race_date, course_code, race_no
)
select
  c.race_date,
  c.course_code,
  c.course_name,
  c.race_no,
  c.race_name,
  c.deadline_time,
  c.race_status,
  c.first_boat,
  regexp_replace(coalesce(e1.racer_name,''), '[[:space:]　]+', '', 'g') as first_racer_name,
  e1.racer_registration_no as first_racer_registration_no,
  e1.gender_code as first_racer_gender_code,
  (e1.gender_code = '2') as first_racer_is_female,
  c.second_boat,
  regexp_replace(coalesce(e2.racer_name,''), '[[:space:]　]+', '', 'g') as second_racer_name,
  e2.racer_registration_no as second_racer_registration_no,
  e2.gender_code as second_racer_gender_code,
  (e2.gender_code = '2') as second_racer_is_female,
  c.third_boat,
  regexp_replace(coalesce(e3.racer_name,''), '[[:space:]　]+', '', 'g') as third_racer_name,
  e3.racer_registration_no as third_racer_registration_no,
  e3.gender_code as third_racer_gender_code,
  (e3.gender_code = '2') as third_racer_is_female,
  coalesce(fc.female_entry_count,0) as female_entry_count,
  (coalesce(fc.female_entry_count,0) > 0) as has_female_entry,
  c.winning_technique_code,
  c.trifecta,
  c.trifecta_payout,
  c.trifecta_popularity,
  c.result_confirmation_reason,
  c.effective_result_available,
  (c.first_boat = 1) as is_boat1_win,
  (c.first_boat <> 1) as is_boat1_loss,
  (c.first_boat in (4,5,6)) as is_outer_win,
  (c.first_boat = 5) as is_boat5_win,
  (c.trifecta_payout >= 10000) as is_man_shu,
  (c.trifecta_payout >= 5000) as is_high_payout,
  (c.second_boat in (4,5,6) or c.third_boat in (4,5,6)) as has_outer_in_place,
  ((c.first_boat = 1) or (c.first_boat <> 1) or (c.first_boat = 1 and c.trifecta_payout >= 5000)) as ichika_candidate,
  ((coalesce(fc.female_entry_count,0) > 0) or (e1.gender_code = '2')) as hatsune_candidate,
  ((c.first_boat in (4,5,6)) or (c.trifecta_payout >= 10000) or (c.second_boat in (4,5,6)) or (c.third_boat in (4,5,6))) as kiina_candidate
from confirmed c
left join public.bs_race_entries e1
  on e1.race_date=c.race_date and e1.course_code=c.course_code and e1.race_no=c.race_no and e1.boat_no=c.first_boat
left join public.bs_race_entries e2
  on e2.race_date=c.race_date and e2.course_code=c.course_code and e2.race_no=c.race_no and e2.boat_no=c.second_boat
left join public.bs_race_entries e3
  on e3.race_date=c.race_date and e3.course_code=c.course_code and e3.race_no=c.race_no and e3.boat_no=c.third_boat
left join female_counts fc
  on fc.race_date=c.race_date and fc.course_code=c.course_code and fc.race_no=c.race_no;