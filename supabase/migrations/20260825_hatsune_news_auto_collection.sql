alter table public.hatsune_news
  add column if not exists source_key text,
  add column if not exists collected_at timestamptz;

create unique index if not exists hatsune_news_source_key_uidx
  on public.hatsune_news (source_key)
  where source_key is not null;

create index if not exists hatsune_news_collected_at_idx
  on public.hatsune_news (collected_at desc);
