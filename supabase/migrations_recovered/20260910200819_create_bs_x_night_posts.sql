create table if not exists public.bs_x_night_posts (
  race_date date primary key,
  snapshot_generated_at timestamptz,
  snapshot_news_count integer not null default 0,
  snapshot_result_count integer not null default 0,
  posts jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bs_x_night_posts_generated_at
  on public.bs_x_night_posts (generated_at desc);
