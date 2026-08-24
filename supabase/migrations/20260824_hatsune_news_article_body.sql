alter table public.hatsune_news
  add column if not exists article_body text;

create or replace function public.build_hatsune_news_article_body(
  p_title text,
  p_summary text,
  p_category text,
  p_place text,
  p_source_type text
)
returns text
language plpgsql
as $$
declare
  v_place text := coalesce(nullif(trim(p_place), ''), '開催地');
  v_summary text := coalesce(nullif(trim(p_summary), ''), '詳細情報を確認しています。');
  v_focus text;
begin
  v_focus := case p_category
    when 'result' then 'レース結果のポイントと、次走に向けて注目したい内容を整理します。'
    when 'women' then '女子戦の流れをつかむうえで押さえておきたいトピックです。シリーズの今後にも注目です。'
    when 'suijinsai' then 'レーサーにとって節目となるニュースです。今後の成長や次走での走りにも注目したいところです。'
    when 'win' then '優勝までの流れと、今節を通して見せた強さに注目したいニュースです。'
    when 'grade' then '級別や成績面で大きな節目となるニュースです。今後の出走メンバーや番組での評価にも影響してきます。'
    when 'motor' then 'モーター気配を判断するうえで重要な材料です。数字だけでなく、展示や実戦での動きも合わせて確認したいところです。'
    when 'tomorrow' then '明日のレースをチェックする際に押さえておきたいポイントです。進入、モーター気配、直前展示まで含めて確認していきます。'
    else '女子ボートレースを追ううえで押さえておきたいニュースです。今後のレースや選手評価につながるポイントを整理します。'
  end;

  return
    '『' || coalesce(nullif(trim(p_title), ''), '初音NEWS') || '』について、BoatStrikersが要点をまとめます。' ||
    v_summary || ' ' ||
    v_place || 'に関する今回の情報は、女子戦をチェックするうえで見逃せない材料のひとつです。' ||
    v_focus ||
    ' BoatStrikersでは、公式・報道情報をそのまま転載するのではなく、内容を要約したうえで、レースを見るときに役立つ視点を加えて紹介しています。' ||
    case when p_source_type = 'bs_data'
      then 'この記事にはBoatStrikers独自データを含みます。数値は過去データや取得時点の集計結果をもとにしており、直前気配や最新情報と合わせてご覧ください。'
      else '正式な発表内容や最新情報については、記事末尾の出典元もあわせてご確認ください。'
    end;
end;
$$;

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
  end if;
  return new;
end;
$$;

drop trigger if exists trg_hatsune_news_article_body on public.hatsune_news;
create trigger trg_hatsune_news_article_body
before insert or update of title, summary, category, place, source_type, article_body
on public.hatsune_news
for each row
execute function public.set_hatsune_news_article_body();

update public.hatsune_news
set article_body = public.build_hatsune_news_article_body(title, summary, category, place, source_type)
where article_body is null or btrim(article_body) = '';
