-- 提案（未適用）：前日版新聞の自動下書きを「1日・1キャラ・1件」に制限するDB制約。
-- supabase/migrations には置いていない。本番に適用する場合は、承認を得てから
-- 正式なマイグレーションとして追加し、ステージングで確認してから適用すること。
--
-- なぜ必要か
--   既存の一意キー (race_date, course_name, race_no, character_key, edition) は「同じレース」の重複しか防げない。
--   自動下書きの実行が同時に2つ走り、締切時刻の判定などで別々のレースを選ぶと、同じキャラに2件できうる。
--   アプリ側の「作成済みか確認してから作る」だけでは、確認と作成の間に割り込まれるため保証できない。
--
-- 方式
--   自動下書きで作った行だけに auto_draft_generator を入れ、その行に限って
--   (race_date, character_key, edition) の部分ユニーク索引を張る。
--   手動保存（POST /api/admin/newspapers）はこの列を送らないので、
--   手動で編集・公開しても値は残り、「その日の自動枠を使った」ことが保たれる。
--   手動で作った新聞は NULL のままなので、この制約の対象外（手動作成は制限しない）。

begin;

alter table public.bs_newspaper_publications
  add column if not exists auto_draft_generator text;

comment on column public.bs_newspaper_publications.auto_draft_generator is
  '自動下書きで作成した場合の生成器名（例：auto-previous-day-v1）。手動作成は NULL。';

-- 既存データに自動下書きは無い想定だが、念のため作成前に重複が無いことを確認する。
do $$
begin
  if exists (
    select 1 from public.bs_newspaper_publications
    where auto_draft_generator is not null
    group by race_date, character_key, edition
    having count(*) > 1
  ) then
    raise exception 'STOP: 同じ日・キャラ・版の自動下書きが複数あります。先に整理してください。';
  end if;
end
$$;

create unique index if not exists bs_newspaper_publications_auto_draft_slot_idx
  on public.bs_newspaper_publications (race_date, character_key, edition)
  where auto_draft_generator is not null;

commit;

-- 適用後にアプリ側で設定する環境変数：NEWSPAPER_AUTO_DRAFT_SLOT_CONSTRAINT=true
-- （この設定が無い限り、自動下書きは書き込みを行わない）
--
-- 元に戻す場合（承認後）：
--   drop index if exists public.bs_newspaper_publications_auto_draft_slot_idx;
--   alter table public.bs_newspaper_publications drop column if exists auto_draft_generator;
