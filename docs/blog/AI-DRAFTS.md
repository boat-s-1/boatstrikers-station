# BLOG AI下書き（feature/blog-ai-drafts）

**目的**：テーマ選定 → 公式情報の取得 → AIによる記事生成 → アイキャッチ作成 → 下書き保存までを自動化する。人が行うのは確認と公開承認だけ。

**AI は記事を公開しない**
- AI 側のコード（`lib/blog/ai/*`、`/api/admin/blog/ai/*`）は、`blog_release` を一切呼ばない。
- AI 生成の記事は、現在の編集版に対する承認が無い限り、DB の `blog_release` が公開・予約を拒否する（`BLOG_AI_APPROVAL_REQUIRED`）。

## 流れ
1. **テーマ**（`/admin/blog/ai` の手順 1）
   - カテゴリー×24場の候補から登録する（`blog_topics`。`topic_key` は一意）。
   - 既存の BLOG 記事・DATA LAB 記事とのタイトル類似度も確かめる。80%以上なら生成を止め、60%以上なら警告する。
2. **公式情報**（手順 2）
   - 対象になる URL：
     - BOAT RACE 公式の場データ（リポジトリで確認済みの URL。`lib/stadiumBasicGuide24.js` の `officialUrl`）
     - 管理者が登録した場の公式サイトや、手動で登録した URL
   - 取得のたびに、取得元・取得日時・HTTP ステータス・SHA-256・抽出した本文、または失敗の理由を `blog_source_documents` に残す。
   - 取得の条件：https のみ、登録済みのホストのみ、robots.txt に従う、15秒で打ち切り、2MBまで、Shift_JIS・EUC-JP に対応。
3. **生成**（手順 1 の「AIで下書きを作成」）
   - 公式情報の取得が7日以上前なら、取り直す。
   - ソースパックを作る（事実・出典 ID・取得日時）。
   - OpenAI Responses API を JSON スキーマ（strict）で呼ぶ。
   - 本文を既存の文書形式に変換し、自動確認を行う。
   - テンプレートの表紙を生成し、非公開バケットに保存する。
   - `blog_create_draft` で下書きとして保存し、来歴を `blog_ai_drafts` に記録する。
4. **確認と承認**（記事編集画面の「AI下書きの確認」）
   - 承認者名を入力して「この版を承認する」を押す。
   - サーバーが現在の版で自動確認をやり直し、要修正が0件のときだけ `blog_ai_approve` が承認を記録する。
   - 記録する内容：名前、ログインセッションのハッシュ、ログイン時刻、版の番号、本文の md5。承認は追記のみで、変更・削除はできない。
5. **公開**：既存の「公開設定」から行う。承認後に保存すると版が進むので、承認は無効になり、再承認が必要になる。

## 事実を作らないための自動確認（`lib/blog/ai/validate.mjs`）
**要修正**（承認できない）
- 出典にない数値（ソースパックの事実・取得本文・期間に無いもの）。
  - 1〜12 に コース・号艇・R などが続くもの、「24場」は除く。
- 数値を含むのに出典が付いていないブロック。
- 出典にない URL。
- 禁止表現：絶対、必勝、鉄板、儲かる、激アツ、買うべき、間違いなし など。
- 公式情報が無いのに作ろうとした場合（24場の魅力・キャラクター）。
- 存在しない出典 ID。

**確認**（警告）
- 取得日時の記録がない収録データ（`lib/stadiumBasicGuide24.js`。集計期間は表示する）。
- AI が挙げた「要確認」項目。
- キャラクターごとに避ける表現。
- 似たタイトル。
- 表紙画像を作れなかった場合。
- タイトル・説明文の長さ。

## 環境変数（値はここに書かない）
| 変数 | 用途 |
|---|---|
| `BLOG_AI_DRAFTS_ENABLED` | `true` のときだけ、テーマ登録・公式情報の取得・生成ができる。既定は無効 |
| `OPENAI_API_KEY` | 既存のものを使う |
| `BLOG_AI_MODEL` | 任意。無ければ `EDITORIAL_AI_MODEL` → `HATSUNE_NEWS_AI_MODEL` → 既存の既定値 |
| `BLOG_SUPABASE_URL` / `BLOG_SUPABASE_SERVICE_ROLE_KEY` / `BLOG_PRIVATE_MEDIA_BUCKET` / `BLOG_ADMIN_ENABLED` / `BLOG_DB_WRITES_ENABLED` | 既存の BLOG 設定 |

## 適用の順序（いずれも事前承認が必要）
1. ステージングの BLOG DB に `supabase/migrations/20261009180000_blog_ai_drafts.sql` を適用する。
2. プレビュー環境で確かめる：`BLOG_AI_DRAFTS_ENABLED=true` にして、通しで1記事を作り、承認と公開を確認する。
3. 本番：
   1. バックアップを確認する。
   2. 本番の BLOG DB にマイグレーションを適用する。
   3. デプロイする。
   4. `BLOG_AI_DRAFTS_ENABLED` を有効にする。

   - **マイグレーションはデプロイより前に適用する。** `lib/blog/catalogue.mjs` に新しいカテゴリーを加えたため、DB に無い状態で公開すると `/blog/categories` から 404 へのリンクができる。
   - マイグレーションを適用する前に AI 機能を有効にすると、新しいテーブルが無いため AI の API は失敗する。既存の公開処理への影響は無い。

## 本番 BLOG の稼働状況の確認（読み取り専用。実行は承認後）
**どの DB で実行するか**
- BLOG は、レース用 DB とは別の Supabase プロジェクトにある（`BLOG_SUPABASE_URL`）。
- Vercel の Production 環境の変数に `BLOG_SUPABASE_URL` があるかを、**名前だけ**確認する（値は表示しない）。
- 本番用の BLOG プロジェクトが無い場合、以下は実行しない。

本番の BLOG プロジェクトの SQL Editor で、1つずつ実行する（どれも参照だけ）。

```sql
-- 1. BLOG のテーブルがあるか
select t, to_regclass('public.' || t) is not null as exists
from unnest(array['blog_posts','blog_post_revisions','blog_media','blog_publication_events','blog_ai_drafts']) t;

-- 2. 適用済みのマイグレーション（BLOG 関連のみ）
select version, name from supabase_migrations.schema_migrations where name ilike '%blog%' order by version;

-- 3. 記事の状態ごとの件数（1. でテーブルがある場合だけ）
select state, count(*) from public.blog_posts group by state order by state;

-- 4. Storage：BLOG 用のバケットの設定（非公開であること）
select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id;

-- 5. 予約公開ジョブ（pg_cron）
select jobid, jobname, schedule, active from cron.job where command ilike '%blog_publish_due%';
select j.jobname, d.status, d.start_time from cron.job_run_details d join cron.job j using (jobid)
where j.command ilike '%blog_publish_due%' order by d.start_time desc limit 5;
```

## 検証済みと未検証
**検証済み**
- `node --test tests/blog/*.test.mjs`（リポジトリ直下から実行）：112件合格、失敗0、スキップ12（任意の HTTP テスト）。
  - DB：PGlite でマイグレーション3本を適用して確認。
  - 取得・生成・確認・承認：模擬の fetch・AI・ストアで確認。
  - 表紙：実際に PNG を生成して確認。
- `next build`：コンパイルは成功した。プリレンダーは、関係のない `/bsc2/admin/ai-dashboard` が Firebase の環境変数が無いために止まった（この作業環境の事情）。
- 管理画面 `/admin/blog/ai`：ローカルの開発サーバーで、画面の構成とスマートフォン幅で横スクロールしないことを確認した。DB 未接続の状態。

**未検証**
- 実際の BLOG DB への接続。
- OpenAI の実際の呼び出し。
- 公式サイトからの実際の取得（この作業環境では boatrace.jp への通信が遮断されている）。
- 本番の Vercel 上での日本語フォントの描画。
