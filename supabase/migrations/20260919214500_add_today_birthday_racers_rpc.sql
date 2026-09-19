-- Service-role-only helper for TODAY birthday racer cards.
create or replace function public.bs_today_birthday_racers(
  p_date date
)
returns table (
  registration_no text,
  name text,
  birthday date,
  branch text,
  racer_class text,
  course_code integer,
  race_no integer,
  boat_no integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    r.registration_no,
    r.name,
    r.birthday,
    r.branch,
    r.racer_class,
    e.course_code,
    e.race_no,
    e.boat_no
  from public.bs_racers r
  join public.bs_race_entries e
    on e.racer_registration_no = r.registration_no
  where r.is_active = true
    and r.birthday is not null
    and e.race_date = p_date
    and extract(month from r.birthday) = extract(month from p_date)
    and extract(day from r.birthday) = extract(day from p_date)
  order by r.registration_no, e.course_code, e.race_no;
$$;

revoke all on function public.bs_today_birthday_racers(date)
  from public, anon, authenticated;
grant execute on function public.bs_today_birthday_racers(date)
  to service_role;
