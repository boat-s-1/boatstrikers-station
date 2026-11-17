create table if not exists public.bs_elimination_odds_snapshots (
  id bigserial primary key,
  race_date date not null,
  course_code smallint not null,
  race_no smallint not null,
  captured_at timestamptz not null default now(),
  source text not null default 'boatrace_official',
  odds jsonb not null,
  odds_count integer not null default 0,
  unique (race_date, course_code, race_no, captured_at)
);

create index if not exists idx_bs_elimination_odds_snapshots_race
  on public.bs_elimination_odds_snapshots (race_date, course_code, race_no, captured_at desc);

comment on table public.bs_elimination_odds_snapshots is 'Pre-race 3連単120通りオッズ snapshots for elimination lab VALUE backtesting';