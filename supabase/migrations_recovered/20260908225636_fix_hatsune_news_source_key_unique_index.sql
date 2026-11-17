drop index if exists public.hatsune_news_source_key_uidx;
create unique index hatsune_news_source_key_uidx on public.hatsune_news(source_key);