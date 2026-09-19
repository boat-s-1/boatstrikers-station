-- Canonical BOAT RACE racer profile master used by birthday and profile features.
create table if not exists public.bs_racers (
  registration_no text primary key
    check (registration_no ~ '^[0-9]{5}$'),
  official_registration_no text not null unique
    check (official_registration_no ~ '^[0-9]{4,5}$'),

  name text not null,
  name_kana text,
  birthday date,

  branch text,
  birthplace text,
  gender text
    check (gender is null or gender in ('M', 'F')),
  racer_class text
    check (racer_class is null or racer_class in ('A1', 'A2', 'B1', 'B2')),
  registration_term smallint
    check (registration_term is null or registration_term > 0),

  height_cm smallint
    check (height_cm is null or height_cm between 100 and 250),
  weight_kg numeric(5,2)
    check (weight_kg is null or weight_kg between 30 and 150),
  blood_type text,

  is_active boolean not null default true,

  source text not null default 'boatrace_official',
  source_url text,
  source_fetched_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bs_racers_birthday_month_day_idx
  on public.bs_racers (
    extract(month from birthday),
    extract(day from birthday)
  )
  where birthday is not null and is_active = true;

create index if not exists bs_racers_active_registration_idx
  on public.bs_racers (is_active, registration_no);

comment on table public.bs_racers is
  'Canonical BOAT RACE racer profile master keyed to bs_race_entries.racer_registration_no.';

comment on column public.bs_racers.registration_no is
  'BoatStrikers five-digit zero-padded registration number, e.g. 04296.';

comment on column public.bs_racers.official_registration_no is
  'Registration number used by the BOAT RACE official racer profile URL, e.g. 4296.';

alter table public.bs_racers enable row level security;

-- Internal master: direct browser access is intentionally disabled.
revoke all on table public.bs_racers from public, anon, authenticated;
grant all on table public.bs_racers to service_role;

-- Return recent racers that do not yet have a canonical profile.
-- SECURITY INVOKER keeps the caller's permissions; only service_role may execute.
create or replace function public.bs_racer_sync_candidates(
  p_recent_days integer default 90,
  p_limit integer default 100
)
returns table (
  racer_registration_no text,
  racer_name text,
  racer_name_kana text,
  racer_branch text,
  racer_class text,
  gender text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    src.racer_registration_no,
    src.racer_name,
    src.racer_name_kana,
    src.racer_branch,
    src.racer_class,
    src.gender
  from (
    select distinct on (e.racer_registration_no)
      e.racer_registration_no,
      e.racer_name,
      e.racer_name_kana,
      e.racer_branch,
      e.racer_class,
      e.gender,
      e.race_date,
      e.updated_at
    from public.bs_race_entries e
    where e.racer_registration_no is not null
      and btrim(e.racer_registration_no) <> ''
      and e.race_date >= current_date - greatest(p_recent_days, 1)
    order by
      e.racer_registration_no,
      e.race_date desc,
      e.updated_at desc nulls last
  ) src
  where not exists (
    select 1
    from public.bs_racers r
    where r.registration_no = src.racer_registration_no
  )
  order by src.race_date desc, src.racer_registration_no
  limit least(greatest(p_limit, 1), 500);
$$;

revoke all on function public.bs_racer_sync_candidates(integer, integer)
  from public, anon, authenticated;
grant execute on function public.bs_racer_sync_candidates(integer, integer)
  to service_role;
