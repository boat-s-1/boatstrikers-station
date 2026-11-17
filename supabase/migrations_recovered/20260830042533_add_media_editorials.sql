create table if not exists public.media_editorials (
  video_id text primary key,
  place text not null,
  official_title text not null,
  official_url text not null,
  short_headline text null,
  intro text null,
  highlights jsonb null,
  editor_note text null,
  model text null,
  generated_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.media_editorials enable row level security;
