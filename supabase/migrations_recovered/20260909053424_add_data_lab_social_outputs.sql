alter table public.bs_daily_result_digests enable row level security;
grant select, insert, update, delete on public.bs_daily_result_digests to service_role;

create table if not exists public.bs_data_lab_social_outputs (
  id bigint generated always as identity primary key,
  race_date date not null unique,
  status text not null default 'draft',
  x_post_text text,
  short_script text,
  image_payload jsonb not null default '{}'::jsonb,
  hashtags text[] not null default '{}'::text[],
  source_digest_id bigint references public.bs_daily_result_digests(id) on delete set null,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bs_data_lab_social_outputs enable row level security;
grant select, insert, update, delete on public.bs_data_lab_social_outputs to service_role;
create index if not exists bs_data_lab_social_outputs_race_date_idx on public.bs_data_lab_social_outputs(race_date desc);