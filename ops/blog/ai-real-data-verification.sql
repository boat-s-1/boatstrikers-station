-- READ-ONLY verification of the BLOG research datasets against the race tables (PHASE 2).
-- An independent SQL implementation of the race-level rules in lib/blog/ai/data/raceQuality.mjs and the metrics in
-- lib/blog/ai/data/datasets.mjs. Run on the race database (production) with SELECT only; it writes nothing.
-- Edit the three values in "params". course_code null = all stadiums. Output: one JSON row per dataset with
-- population, usable, excluded reasons and metrics, to compare with computeDataset() on the same period/scope.
with params as (
  select date '2026-10-04' as date_from, date '2026-11-02' as date_to, 1::smallint as course_code
),
res as (
  select r.* from public.bs_race_results r, params p
  where r.race_date between p.date_from and p.date_to and (p.course_code is null or r.course_code = p.course_code)
),
ev as (
  select e.* from public.bs_race_events e, params p
  where e.race_date between p.date_from and p.date_to and (p.course_code is null or e.course_code = p.course_code)
),
races as (
  select coalesce(r.race_date, e.race_date) race_date, coalesce(r.course_code, e.course_code) course_code, coalesce(r.race_no, e.race_no) race_no,
    r.race_date is not null as has_result, r.result_status, r.trifecta_result, r.winning_trifecta, r.first_boat, r.trifecta_payout,
    coalesce(r.winning_technique, r.winning_method) technique_raw,
    e.race_date is not null as has_event, e.race_status ev_status, e.race_cancel_code, e.trifecta ev_trifecta, e.trifecta_payout ev_payout
  from res r full join ev e on e.race_date = r.race_date and e.course_code = r.course_code and e.race_no = r.race_no
),
norm as (
  select x.*,
    case when regexp_replace(coalesce(trifecta_result, ''), '[-\s]', '', 'g') ~ '^[1-6]{3}$'
          and substr(regexp_replace(trifecta_result, '[-\s]', '', 'g'), 1, 1) <> substr(regexp_replace(trifecta_result, '[-\s]', '', 'g'), 2, 1)
          and substr(regexp_replace(trifecta_result, '[-\s]', '', 'g'), 1, 1) <> substr(regexp_replace(trifecta_result, '[-\s]', '', 'g'), 3, 1)
          and substr(regexp_replace(trifecta_result, '[-\s]', '', 'g'), 2, 1) <> substr(regexp_replace(trifecta_result, '[-\s]', '', 'g'), 3, 1)
         then regexp_replace(trifecta_result, '[-\s]', '', 'g') end as tri,
    nullif(regexp_replace(coalesce(winning_trifecta, ''), '[-\s]', '', 'g'), '') as wtri,
    nullif(regexp_replace(coalesce(ev_trifecta, ''), '[-\s]', '', 'g'), '') as etri,
    nullif(regexp_replace(coalesce(technique_raw, ''), '[\s　]', '', 'g'), '') as tech
  from races x
  -- cancelled races with no result are not part of any population
  where not (not has_result and has_event and (coalesce(race_cancel_code, '') <> '' or ev_status = 'cancelled'))
),
ent as (
  select e.race_date, e.course_code, e.race_no, e.boat_no, e.actual_course, e.arrival_order, e.gender_code,
    case when trim(coalesce(e.racer_registration_no, '')) ~ '^\d{1,6}$' then nullif(ltrim(trim(e.racer_registration_no), '0'), '') end as reg
  from public.bs_race_entries e, params p
  where e.race_date between p.date_from and p.date_to and (p.course_code is null or e.course_code = p.course_code)
),
ent_g as (
  select n.race_date, n.course_code, n.race_no, n.boat_no, n.actual_course, n.arrival_order, n.gender_code, m.racer_gender g
  from ent n left join public.racer_gender_master m on m.racer_id::text = n.reg and m.racer_gender in ('F','M')
),
per_race as (
  select race_date, course_code, race_no,
    count(*) n_rows,
    count(distinct boat_no) filter (where boat_no between 1 and 6) n_boats,
    count(*) filter (where actual_course between 1 and 6) n_course,
    count(distinct actual_course) filter (where actual_course between 1 and 6) n_dcourse,
    count(*) filter (where g is null) n_gender_unknown,
    count(*) filter (where (gender_code::text = '1' and g = 'F') or (gender_code::text = '2' and g = 'M')) n_gender_conflict,
    count(*) filter (where g = 'F') n_female,
    jsonb_object_agg(boat_no::text, jsonb_build_object('c', actual_course, 'a', arrival_order)) by_boat
  from ent_g group by 1, 2, 3
),
flags as (
  select n.*, pr.by_boat,
    coalesce(pr.n_rows = 6 and pr.n_boats = 6, false) complete,
    (not has_result) f_result_missing,
    (has_result and coalesce(result_status, '') not in ('finished', 'confirmed')) f_unconfirmed,
    (has_result and has_event and (coalesce(race_cancel_code, '') <> '' or ev_status = 'cancelled')) f_cancelled,
    (has_result and tri is null) f_invalid,
    (tri is not null and ((wtri is not null and wtri is distinct from tri) or (etri is not null and etri is distinct from tri))) f_tri_conflict,
    (tri is not null and first_boat is not null and first_boat::text <> substr(tri, 1, 1)) f_first_conflict,
    (tri is not null and coalesce(pr.n_rows = 6 and pr.n_boats = 6, false) and (pr.by_boat -> substr(tri, 1, 1) ->> 'a') is not null
      and (pr.by_boat -> substr(tri, 1, 1) ->> 'a')::int <> 1) f_arrival_conflict,
    (coalesce(pr.n_rows = 6 and pr.n_boats = 6, false) and not (pr.n_course = 6 and pr.n_dcourse = 6)) f_course_missing,
    (has_result and (tech is null or tech not in ('逃げ','差し','まくり','まくり差し','抜き','恵まれ'))) f_tech_missing,
    case when coalesce(pr.n_rows = 6 and pr.n_boats = 6, false) and pr.n_course = 6 and pr.n_dcourse = 6 and tri is not null
      then (pr.by_boat -> substr(tri, 1, 1) ->> 'c')::int end winner_course,
    (has_result and (trifecta_payout is null or trifecta_payout <= 0)) f_payout_missing,
    (has_result and trifecta_payout > 0 and ev_payout is not null and ev_payout <> trifecta_payout) f_payout_conflict,
    (coalesce(pr.n_rows = 6 and pr.n_boats = 6, false) and pr.n_gender_unknown > 0) f_gender_unknown,
    (coalesce(pr.n_rows = 6 and pr.n_boats = 6, false) and pr.n_gender_conflict > 0) f_gender_conflict,
    (coalesce(pr.n_rows = 6 and pr.n_boats = 6, false) and pr.n_gender_unknown = 0 and pr.n_gender_conflict = 0 and pr.n_female = 6) all_female,
    (has_result and coalesce(pr.n_rows = 6 and pr.n_boats = 6, false) and pr.n_gender_unknown = 0 and pr.n_gender_conflict = 0 and pr.n_female < 6) known_mixed
  from norm n left join per_race pr using (race_date, course_code, race_no)
),
groups as (
  select f.*,
    (f_result_missing or f_unconfirmed or f_cancelled or f_invalid or f_tri_conflict or f_first_conflict or f_arrival_conflict) bad_result,
    (not complete or f_course_missing or f_tech_missing
      or (winner_course is not null and tech in ('逃げ') and winner_course <> 1)
      or (winner_course is not null and tech in ('差し','まくり','まくり差し') and winner_course = 1)) bad_course,
    (f_payout_missing or f_payout_conflict) bad_payout,
    (not complete or f_gender_unknown or f_gender_conflict) bad_gender,
    (winner_course is not null and ((tech = '逃げ' and winner_course <> 1) or (tech in ('差し','まくり','まくり差し') and winner_course = 1))) f_tech_course_conflict
  from flags f
),
reasons as (
  -- one row per race and reason, tagged by the field group the reason belongs to
  select race_date, course_code, race_no, g, reason from groups,
  lateral (values
    ('result', case when f_result_missing then 'result_missing' end), ('result', case when f_unconfirmed then 'result_unconfirmed' end),
    ('result', case when f_cancelled then 'cancelled' end), ('result', case when f_invalid then 'invalid_trifecta' end),
    ('result', case when f_tri_conflict then 'trifecta_conflict' end), ('result', case when f_first_conflict then 'first_boat_conflict' end),
    ('result', case when f_arrival_conflict then 'arrival_conflict' end),
    ('course', case when not complete then 'entries_incomplete' end), ('course', case when f_course_missing then 'course_missing' end),
    ('course', case when f_tech_missing then 'technique_missing' end), ('course', case when f_tech_course_conflict then 'technique_course_conflict' end),
    ('payout', case when f_payout_missing then 'payout_missing' end), ('payout', case when f_payout_conflict then 'payout_conflict' end),
    ('gender', case when not complete then 'entries_incomplete' end), ('gender', case when f_gender_unknown then 'gender_unknown' end),
    ('gender', case when f_gender_conflict then 'gender_conflict' end)
  ) v(g, reason) where reason is not null
    -- a race with no result row is excluded for that reason only (as in assessRace: nothing else is examined)
    and (has_result or reason = 'result_missing')
),
datasets(definition, needs) as (values
  ('inside_escape', array['result','course']), ('women_inside_escape', array['result','course','gender']),
  ('boat5_win', array['result']), ('high_payout', array['result','payout'])
),
scored as (
  select d.definition, g.*,
    not ((bad_result) or ('course' = any(d.needs) and bad_course) or ('payout' = any(d.needs) and bad_payout) or ('gender' = any(d.needs) and bad_gender)) usable
  from datasets d cross join groups g
),
member as (
  -- women's dataset: usable races must be all-female; unusable races count unless known to be mixed
  select * from scored where definition <> 'women_inside_escape' or (usable and all_female) or (not usable and not known_mixed)
)
select m.definition,
  count(*) population,
  count(*) filter (where usable) usable,
  (select jsonb_object_agg(reason, n) from (
     select r.reason, count(distinct (r.race_date, r.course_code, r.race_no)) n from reasons r join member x
       on x.definition = m.definition and not x.usable and r.race_date = x.race_date and r.course_code = x.course_code and r.race_no = x.race_no
       join datasets d on d.definition = m.definition and r.g = any(d.needs)
     group by r.reason) z) excluded,
  jsonb_build_object(
    'escapes', count(*) filter (where usable and winner_course = 1 and tech = '逃げ'),
    'boat5_wins', count(*) filter (where usable and substr(tri, 1, 1) = '5'),
    'high_count', count(*) filter (where usable and trifecta_payout >= 10000),
    'boat5_in_high', count(*) filter (where usable and trifecta_payout >= 10000 and substr(tri, 1, 1) = '5'),
    'median_payout', round((percentile_cont(0.5) within group (order by trifecta_payout) filter (where usable and definition = 'high_payout'))::numeric),
    'techniques', (select jsonb_object_agg(tech, n) from (select x.tech, count(*) n from member x where x.definition = m.definition and x.usable and x.tech is not null group by x.tech) t)
  ) metrics
from member m group by m.definition order by m.definition;
