# 結果記事 訂正の手順書（監査テーブル・1件試験適用・復元）

作成日：2026-10-13／ブランチ：`claude/news-result-guard`

**この文書の SQL はまだ実行していない。** 実行には承認が必要。本番DBへの書き込みを伴う。

## 1. 監査テーブル（設計案）

訂正前の行は全列を丸ごと保全する。保全した内容は書き換えられないようにし、「適用」と「復元」の記録だけを追記できる形にする。

```sql
create table public.hatsune_news_corrections (
  id              bigint generated always as identity primary key,
  news_id         bigint not null references public.hatsune_news(id) on delete restrict,
  batch_id        text   not null,                 -- 例：'result-guard-2026-10'
  reason          text   not null,
  before_row      jsonb  not null,                 -- 訂正直前の hatsune_news の行全体（to_jsonb）
  before_checksum text   not null,                 -- md5(before_row::text)。復元後の一致確認に使う
  after_fields    jsonb  not null,                 -- 実際に更新した列と値（訂正日時を差し込んだ後の本文）
  evidence        jsonb  not null,                 -- 照合根拠（3連単・払戻・1〜3着・決まり手・締切）
  applied_at      timestamptz not null default now(),
  applied_by      text   not null,
  status          text   not null default 'applied' check (status in ('applied', 'restored')),
  restored_at     timestamptz,
  restored_by     text,
  unique (news_id, batch_id)
);

alter table public.hatsune_news_corrections enable row level security;  -- ポリシーなし＝anon / authenticated は読めない
revoke all on public.hatsune_news_corrections from anon, authenticated;

-- 保全した内容は変更・削除しない。復元の記録（status・restored_*）だけ更新できる。
create function public.hatsune_news_corrections_immutable() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'hatsune_news_corrections は削除できません'; end if;
  if new.news_id is distinct from old.news_id or new.batch_id is distinct from old.batch_id
     or new.before_row is distinct from old.before_row or new.before_checksum is distinct from old.before_checksum
     or new.after_fields is distinct from old.after_fields or new.evidence is distinct from old.evidence
     or new.applied_at is distinct from old.applied_at or new.applied_by is distinct from old.applied_by
     or new.reason is distinct from old.reason then
    raise exception '保全した内容は変更できません';
  end if;
  return new;
end $$;
create trigger trg_hatsune_news_corrections_immutable
  before update or delete on public.hatsune_news_corrections
  for each row execute function public.hatsune_news_corrections_immutable();
```

## 2. 訂正の表示方針（読者向け）

- 公開日時（`published_at`）と見出し（`title`）は変えない。一覧の並び順も変わらない。
- 本文の先頭に「【訂正】訂正日時」と訂正理由を入れる。訂正日時は、適用時の `now()`（JST）を本文に差し込む。
- 記事ページはキャッシュしない設定（`revalidate = 0`）なので、適用後すぐ表示に反映される。NEWS 一覧の索引は最大120秒で更新される。
- 本文以外で訂正を示す表示（記事ページの日付の横の「訂正あり」など）は、NEWS 画面の変更になるため今回は入れていない。必要なら別途承認をいただいて実装する。

## 3. SEO・構造化データ・OGP・SNS への影響（調査結果）

| 項目 | 現状 | 訂正による影響 |
|---|---|---|
| meta description | 記事ページの `generateMetadata` が要約（summary）から作る | 訂正後の要約（1着・3連単・払戻）に変わる。誤りが解消される |
| canonical・robots | canonical は `/news/{id}`。robots は要約・本文の量で index を判断する | 変わらない。訂正後も、要約が40字以上なので index のまま |
| 構造化データ（JSON-LD） | NEWS 記事に NewsArticle などの構造化データは出力していない | 影響なし（dateModified なども出力していない） |
| OGP | 記事ページに openGraph の個別設定はない | 共有時のタイトルは変わらない。説明文が訂正後の要約になる場合がある |
| サイトマップ | `/news` だけで、記事ごとの URL・更新日時は載せていない | 影響なし。検索エンジンは通常の再クロールで反映する |
| SNS 連携 | リポジトリ内に、hatsune_news の更新をきっかけに X などへ自動投稿する処理は見当たらない。日次まとめの X 投稿文は別のデータ | 自動の再投稿は起きない。過去に手動で投稿・動画化したものがあれば、それは訂正されない（管理画面の動画作成の履歴を確認する必要あり） |
| 他の処理による上書き | AI 本文生成は `article_body_source = 'manual'` を再生成しない。メディア・一般ニュースの同期は `source_type = news` や `general:*` だけを対象にする。本文補完トリガーは本文が空のときだけ動く | 訂正本文が自動で上書きされることはない |

## 4. 1件だけ試験適用する手順（対象：id 1848）

適用者は service_role（SQL エディタ、または管理用スクリプト）。1つのトランザクションで実行し、確認で1つでも合わなければ ROLLBACK する。

```sql
begin;

-- 0) 前提確認：記事が訂正前のままで、公開中で、確定結果が変わっていないこと（1つでも false なら ROLLBACK）
select
  md5(coalesce(n.summary,'') || '|' || coalesce(n.article_body,'')) = '740daffeebf5e8d808a866f7d6b110f5' as body_unchanged,
  n.is_published,
  n.published_at,
  regexp_replace(e.trifecta,'[^1-6]','','g') = '423' and e.trifecta_payout = 41720 as event_ok,
  x.result_status = 'confirmed' and replace(x.winning_trifecta,'-','') = '423' and x.trifecta_payout = 41720 as result_ok
from public.hatsune_news n
join public.bs_race_events e on e.race_date = '2026-10-13' and e.course_code = 18 and e.race_no = 5
join public.bs_race_results x on x.race_date = e.race_date and x.course_code = e.course_code and x.race_no = e.race_no
where n.id = 1848
for update of n;

-- 1) 訂正日時（JST）を決め、本文に差し込んで、保全と更新を行う
do $$
declare
  v_at  timestamptz := now();
  v_jst text := to_char(v_at at time zone 'Asia/Tokyo', 'YYYY"年"FMMM"月"FMDD"日" HH24:MI');
  v_summary text := $s$2026年10月13日の徳山5R（出走6名がすべて女子選手のレース）は、4号艇の木村紗友希選手が1着。3連単4-2-3（払戻41,720円）で確定しました。$s$;
  v_body text := replace($b$【訂正】［訂正日時：適用時に記入］
この記事は、2026年10月13日 10:00の公開時点でレースの締切前だったにもかかわらず「結果が確定した」と掲載していました。確定したレース結果に基づいて本文を訂正しました。訂正前の内容は記録として保管しています。

2026年10月13日 徳山5R（出走6名がすべて女子選手のレース）の確定結果
1着　4号艇　木村紗友希（4コース・ST.11）
2着　2号艇　渡辺千草（2コース・ST.08）
3着　3号艇　福山恵里奈（3コース・ST.11）
決まり手　差し
3連単　4-2-3　払戻41,720円

出典：BoatStrikers レースDB（確定結果）$b$, '［訂正日時：適用時に記入］', v_jst);
  v_before jsonb;
begin
  select to_jsonb(n) into v_before from public.hatsune_news n where n.id = 1848;
  insert into public.hatsune_news_corrections (news_id, batch_id, reason, before_row, before_checksum, after_fields, evidence, applied_at, applied_by)
  values (
    1848, 'result-guard-2026-10',
    '公開時点でレースの締切前だったにもかかわらず「結果が確定した」と掲載していたため',
    v_before, md5(v_before::text),
    jsonb_build_object('summary', v_summary, 'article_body', v_body, 'article_body_source', 'manual', 'updated_at', v_at),
    '{"race_date":"2026-10-13","course_code":18,"race_no":5,"closing_time":"10:32:00","trifecta":"4-2-3","payout":41720,"technique":"差し","popularity":null,"all_female":true,"top3":[{"order":1,"boat":4,"name":"木村紗友希"},{"order":2,"boat":2,"name":"渡辺千草"},{"order":3,"boat":3,"name":"福山恵里奈"}]}'::jsonb,
    v_at, 'admin:<適用者名>'
  );
  update public.hatsune_news
     set summary = v_summary,
         article_body = v_body,
         article_body_source = 'manual',
         updated_at = v_at
   where id = 1848
     and published_at = (v_before->>'published_at')::timestamptz;   -- 公開日時は変えない
  if not found then raise exception '更新対象が見つからない'; end if;
end $$;

-- 2) 確認（すべて true でなければ ROLLBACK）
select
  n.published_at = (c.before_row->>'published_at')::timestamptz as published_kept,
  n.title = c.before_row->>'title' as title_kept,
  n.is_published = (c.before_row->>'is_published')::boolean as visibility_kept,
  n.article_body like '【訂正】20%' as correction_note,
  n.article_body not like '%［訂正日時：適用時に記入］%' as time_filled,
  n.article_body like '%3連単　4-2-3　払戻41,720円%' as result_in_body
from public.hatsune_news n
join public.hatsune_news_corrections c on c.news_id = n.id and c.batch_id = 'result-guard-2026-10'
where n.id = 1848;

commit;   -- 確認がすべて true のときだけ
```

適用後の確認：
1. `https://www.boat-strike.online/news/1848` で、本文の先頭に【訂正】と訂正日時、確定結果が表示されること。
2. 一覧での位置（公開日時順）が変わらないこと。
3. 翌日の AI 本文生成（10:00）の後も、本文が変わっていないこと（manual のため）。

## 5. 復元手順（id 1848）

```sql
begin;
update public.hatsune_news n
   set summary             = c.before_row->>'summary',
       article_body        = c.before_row->>'article_body',
       article_body_source = c.before_row->>'article_body_source',
       article_ai_model    = c.before_row->>'article_ai_model',
       updated_at          = (c.before_row->>'updated_at')::timestamptz
  from public.hatsune_news_corrections c
 where c.news_id = n.id and n.id = 1848
   and c.batch_id = 'result-guard-2026-10' and c.status = 'applied';

-- 復元できたことの確認：訂正前と同じ内容に戻ったか（true でなければ ROLLBACK）
select md5(coalesce(n.summary,'') || '|' || coalesce(n.article_body,'')) = '740daffeebf5e8d808a866f7d6b110f5' as restored
  from public.hatsune_news n where n.id = 1848;

update public.hatsune_news_corrections
   set status = 'restored', restored_at = now(), restored_by = 'admin:<復元者名>'
 where news_id = 1848 and batch_id = 'result-guard-2026-10' and status = 'applied';
commit;
```

- 本文補完トリガーは本文が空のときだけ動くため、訂正前の本文（空でない）はそのまま戻る。
- 訂正前の `before_row` には全列が入っているので、上の4列以外も含めて完全に戻すことができる。

## 6. 残り45件の適用（1件目の確認後）

- 1件目の表示・翌日の AI 生成後の状態を確認してから行う。
- 適用直前に `docs/news-result-corrections.json` を DB の確定値で作り直し、差分が無いことを確認する（2026-10-13 18時台の再照合では46件すべて一致）。
- 1件ずつ上と同じ手順（前提確認 → 保全・更新 → 確認）を繰り返す。1件でも確認が合わなければ、その件は止めて報告する。
