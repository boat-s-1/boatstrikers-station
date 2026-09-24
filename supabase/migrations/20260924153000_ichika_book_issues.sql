create table if not exists public.ichika_book_issues (
  id uuid primary key default gen_random_uuid(),
  series text not null check (series in ('sensei','meikan','data-lab')),
  issue_no text not null,
  number_label text not null default '',
  title text not null,
  summary text not null default '',
  page_paths jsonb not null default '[]'::jsonb,
  article jsonb not null default '{"kicker":"一果の詳しい解説","lead":"","sections":[]}'::jsonb,
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(series, issue_no)
);

alter table public.ichika_book_issues enable row level security;

-- Public pages read through the server-side service-role client. Admin writes are also server-side only.
revoke all on public.ichika_book_issues from anon, authenticated;

create index if not exists ichika_book_issues_public_idx
  on public.ichika_book_issues(series, status, published_at desc);
