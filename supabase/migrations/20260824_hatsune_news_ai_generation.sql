alter table public.hatsune_news
  add column if not exists article_body_source text not null default 'template',
  add column if not exists article_ai_model text,
  add column if not exists article_ai_generated_at timestamptz,
  add column if not exists article_ai_error text;

alter table public.hatsune_news
  drop constraint if exists hatsune_news_article_body_source_check;

alter table public.hatsune_news
  add constraint hatsune_news_article_body_source_check
  check (article_body_source in ('template', 'ai', 'manual'));

update public.hatsune_news
set article_body_source = 'template'
where article_body_source is null or article_body_source = '';

create or replace function public.set_hatsune_news_article_body()
returns trigger
language plpgsql
as $$
begin
  if new.article_body is null or btrim(new.article_body) = '' then
    new.article_body := public.build_hatsune_news_article_body(
      new.title,
      new.summary,
      new.category,
      new.place,
      new.source_type
    );
    new.article_body_source := 'template';
    new.article_ai_model := null;
    new.article_ai_generated_at := null;
    new.article_ai_error := null;
  end if;
  return new;
end;
$$;
