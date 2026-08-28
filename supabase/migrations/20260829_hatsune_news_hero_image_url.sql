alter table public.hatsune_news
  add column if not exists hero_image_url text;

comment on column public.hatsune_news.hero_image_url
  is '見出し画像URL。推奨 1200x675 (16:9)。';
