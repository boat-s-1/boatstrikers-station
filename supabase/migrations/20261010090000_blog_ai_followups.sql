-- BLOG only. Follow-ups to 20261009180000_blog_ai_drafts.sql:
-- channel derivatives (note / X / YouTube), sources for facts added by people, and a run log for
-- scheduled / manual AI draft generation. Not applied automatically; staging first, production after approval.
begin;

-- Texts derived from an approved or published revision. Nothing here is posted anywhere automatically.
create table public.blog_post_derivatives (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id),
  revision_id uuid not null references public.blog_post_revisions(id),
  channel text not null check (channel in ('note','x','youtube_script','youtube_description')),
  body text not null check (length(body) between 1 and 60000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  model text check (model is null or length(model) <= 100),
  prompt_version text check (prompt_version is null or length(prompt_version) <= 50),
  validation jsonb not null default '[]'::jsonb check (jsonb_typeof(validation) = 'array'),
  blocking_issues integer not null default 0 check (blocking_issues >= 0),
  status text not null default 'draft' check (status in ('draft','discarded')),
  created_by text check (created_by is null or length(created_by) <= 80),
  created_at timestamptz not null default now()
);
create index blog_post_derivatives_post on public.blog_post_derivatives(post_id, created_at desc);

-- A fact a person added while reviewing, with where and when it was checked.
create table public.blog_ai_manual_sources (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id),
  statement text not null check (length(trim(statement)) between 1 and 500),
  source_label text not null check (length(trim(source_label)) between 1 and 200),
  source_url text not null check (source_url ~ '^https://[^[:space:]]+$' and length(source_url) <= 2000),
  checked_at timestamptz not null,
  registered_by text not null check (length(trim(registered_by)) between 1 and 80),
  created_at timestamptz not null default now(),
  check (checked_at <= created_at + interval '5 minutes')
);
create index blog_ai_manual_sources_post on public.blog_ai_manual_sources(post_id, created_at);

-- One row per generation attempt (scheduled or manual), success or failure.
create table public.blog_ai_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null check (trigger in ('schedule','manual')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','succeeded','failed','skipped')),
  topic_id uuid references public.blog_topics(id),
  post_id uuid references public.blog_posts(id),
  message text check (message is null or length(message) <= 500)
);
create index blog_ai_runs_started on public.blog_ai_runs(started_at desc);

do $migration$
declare t text;
begin
  foreach t in array array['blog_post_derivatives','blog_ai_manual_sources','blog_ai_runs'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end;
$migration$;

commit;
