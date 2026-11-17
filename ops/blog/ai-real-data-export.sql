-- READ-ONLY export of race rows for a period/scope, one compact array per race, so that computeDataset() can be run
-- on real data outside the database (scripts/blog/verify-real-data.mjs) and compared with
-- ops/blog/ai-real-data-verification.sql on the same period/scope. SELECT only; writes nothing.
-- women_only = true drops clean mixed races (result present, six known entrants, no gender-code conflict, a male),
-- which are never part of the women's dataset, to keep the export small.
-- Row: [date, course, race, result?, result_status, trifecta_result, winning_trifecta, first_boat, payout, technique_raw,
--       event?, event_status, cancel_code, event_trifecta, event_payout, "boat:reg:course:arrival:gender_code|…"]
with params as (
  select date '2026-10-04' as date_from, date '2026-11-02' as date_to, 1::smallint as course_code, false as women_only
),
keys as (
  select r.race_date, r.course_code, r.race_no from public.bs_race_results r, params p
    where r.race_date between p.date_from and p.date_to and (p.course_code is null or r.course_code = p.course_code)
  union
  select e.race_date, e.course_code, e.race_no from public.bs_race_events e, params p
    where e.race_date between p.date_from and p.date_to and (p.course_code is null or e.course_code = p.course_code)
),
ent as (
  select e.race_date, e.course_code, e.race_no,
    string_agg(concat_ws(':', e.boat_no, coalesce(e.racer_registration_no, ''), coalesce(e.actual_course::text, ''), coalesce(e.arrival_order::text, ''), coalesce(e.gender_code::text, '')), '|' order by e.boat_no) packed,
    -- a clean mixed race (as in assessRace): six boats, every entrant known, no gender-code conflict, at least one male
    count(*) = 6 and count(distinct e.boat_no) = 6 and count(m.racer_gender) = 6
      and not bool_or((e.gender_code::text = '1' and m.racer_gender = 'F') or (e.gender_code::text = '2' and m.racer_gender = 'M'))
      and bool_or(m.racer_gender = 'M') as known_mixed
  from public.bs_race_entries e join keys k using (race_date, course_code, race_no)
  left join public.racer_gender_master m on m.racer_id::text = nullif(ltrim(trim(e.racer_registration_no), '0'), '')
  group by 1, 2, 3
),
rows as (
  select k.race_date, k.course_code, k.race_no, jsonb_build_array(k.race_date, k.course_code, k.race_no,
    r.race_date is not null, r.result_status, r.trifecta_result, r.winning_trifecta, r.first_boat, r.trifecta_payout, coalesce(r.winning_technique, r.winning_method),
    e.race_date is not null, e.race_status, e.race_cancel_code, e.trifecta, e.trifecta_payout, coalesce(n.packed, '')) row
  from keys k
  left join public.bs_race_results r using (race_date, course_code, race_no)
  left join public.bs_race_events e using (race_date, course_code, race_no)
  left join ent n using (race_date, course_code, race_no), params p
  where not p.women_only or not (r.race_date is not null and coalesce(n.known_mixed, false))
)
select jsonb_build_object(
  'races', (select jsonb_agg(row order by race_date, course_code, race_no) from rows),
  -- genders of the entrants exported (normalized registration number → F/M)
  'genders', (select jsonb_object_agg(m.racer_id::text, m.racer_gender) from public.racer_gender_master m
     where m.racer_id::text in (select nullif(ltrim(trim(split_part(x, ':', 2)), '0'), '') from rows, unnest(string_to_array(row->>15, '|')) x))
) as export;
