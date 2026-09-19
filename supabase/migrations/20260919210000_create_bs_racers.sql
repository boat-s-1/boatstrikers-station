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
