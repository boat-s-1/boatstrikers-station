create table if not exists public.bs_x_post_metrics (
  id uuid primary key default gen_random_uuid(),
  draft_id text not null unique,
  account_code text not null check (account_code = any (array['official'::text,'ichika'::text,'hatsune'::text,'kiina'::text])),
  category text not null,
  post_date date,
  impressions bigint not null default 0 check (impressions >= 0),
  likes bigint not null default 0 check (likes >= 0),
  reposts bigint not null default 0 check (reposts >= 0),
  replies bigint not null default 0 check (replies >= 0),
  bookmarks bigint not null default 0 check (bookmarks >= 0),
  profile_visits bigint not null default 0 check (profile_visits >= 0),
  link_clicks bigint not null default 0 check (link_clicks >= 0),
  follows bigint not null default 0 check (follows >= 0),
  notes text,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bs_x_post_metrics_account_date_idx
  on public.bs_x_post_metrics(account_code, post_date desc);
create index if not exists bs_x_post_metrics_category_date_idx
  on public.bs_x_post_metrics(category, post_date desc);

alter table public.bs_x_post_metrics enable row level security;
