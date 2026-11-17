create table if not exists public.bs_newspaper_publications (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  race_date date not null,
  course_name text not null,
  race_no smallint not null check (race_no between 1 and 12),
  character_key text not null check (character_key in ('ichika', 'hatsune', 'kiina')),
  edition text not null check (edition in ('previous_day', 'just_before')),
  title text not null,
  summary text,
  article_body text,
  image_url text,
  note_title text,
  note_body text,
  note_url text,
  x_post text,
  shorts_script text,
  source_payload jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (race_date, course_name, race_no, character_key, edition)
);

create index if not exists bs_newspaper_publications_public_idx
  on public.bs_newspaper_publications (status, race_date desc, character_key);

alter table public.bs_newspaper_publications enable row level security;

drop policy if exists "published newspapers are public" on public.bs_newspaper_publications;
create policy "published newspapers are public"
  on public.bs_newspaper_publications
  for select
  to anon, authenticated
  using (status = 'published');

grant select on public.bs_newspaper_publications to anon, authenticated;

comment on table public.bs_newspaper_publications is
  'Site-first newspaper archive and cross-channel publishing drafts for Ichika, Hatsune and Kiina.';
