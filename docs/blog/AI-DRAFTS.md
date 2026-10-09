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

画面の操作手順は `docs/blog/AI-DRAFTS-GUIDE.md`（初心者向け）を参照。

## 追加機能（第2段）
| 機能 | 内容 | 主なファイル |
|---|---|---|
| **人が追記した事実の出典登録** | 事実・出典名・https の URL・確認した日時・登録者を `blog_ai_manual_sources` に記録する。記事の出典欄に「取得日時・登録者」付きで追加する（保存により版が進み、再承認が必要）。本文の出典 URL は、登録済みの出典でなければ「要修正」になる | `lib/blog/ai/manualSources.mjs`、`/api/admin/blog/ai/drafts/[id]/sources` |
| **note・X・YouTube 原稿** | 承認済みの版、または公開・予約済みで未公開の修正がない版からだけ作る（`blog_post_derivatives`）。note 原稿と YouTube 概要欄は記事から機械的に作る（AI を使わない）。X 投稿と YouTube ショート台本だけ AI を使い、記事にない数値・禁止表現・記事以外の URL は「要修正」。X はリンクを23文字として140文字以内か確認する。自動投稿はしない | `lib/blog/ai/derivatives.mjs`、`/api/admin/blog/ai/posts/[id]/derivatives` |
| **定時の AI 下書き自動作成** | 既定は無効。`BLOG_AI_DRAFTS_ENABLED` と `BLOG_AI_SCHEDULE_ENABLED` の両方が `true` のときだけ動く。登録済みのテーマから1回あたり最大 N 件の下書きを作る。テーマが無い場合、`BLOG_AI_SCHEDULE_AUTO_TOPICS=true` なら日替わりの順番でテーマも選ぶ。すべての実行を `blog_ai_runs` に記録する（手動の生成も同様）。15分以内に実行中のものがあれば見送り、24時間以内に失敗したテーマは再試行しない。**公開はしない**。`/api/cron/blog-ai-drafts`（`CRON_SECRET` 必須）は **vercel.json に登録していない** | `lib/blog/ai/schedule.mjs`、`app/api/cron/blog-ai-drafts/route.js` |
| **アイキャッチの再生成** | 現在のタイトル・カテゴリー・場・キャラクター（指定、または著者）で、テンプレートの表紙を作り直す。表紙と OGP 画像に設定する。全記事で使える。AI 下書きは再承認が必要 | `lib/blog/ai/coverRegen.mjs`、`/api/admin/blog/ai/posts/[id]/cover` |

## 事実を作らないための自動確認（`lib/blog/ai/validate.mjs`）
**要修正**（承認できない）
- 出典にない数値（ソースパックの事実・取得本文・期間に無いもの）。
  - 1〜12 に コース・号艇・R などが続くもの、「24場」は除く。
- 数値を含むのに出典が付いていないブロック。
- 出典にない URL。
- 禁止表現：絶対、必勝、鉄板、儲かる、激アツ、買うべき、間違いなし など。
- 公式情報が無いのに作ろうとした場合（24場の魅力・キャラクター）。
- 存在しない出典 ID。
- 登録されていない出典 URL（取得日時・確認日時の記録がない出典）。

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
| `BLOG_AI_SCHEDULE_ENABLED` | 定時の自動作成。既定は無効。`BLOG_AI_DRAFTS_ENABLED` も必要 |
| `BLOG_AI_SCHEDULE_MAX_PER_RUN` | 1回あたりの最大件数（1〜3、既定は1） |
| `BLOG_AI_SCHEDULE_AUTO_TOPICS` | `true` のとき、登録済みのテーマが無ければ自動で選ぶ。既定は無効 |
| `BLOG_AI_SCHEDULE_CATEGORIES` | 自動で選ぶカテゴリー（既定は `stadium-basics,stadiums,stadium-charm`） |
| `CRON_SECRET` | 既存のもの。定時実行の認証に使う |
| `BLOG_SUPABASE_URL` / `BLOG_SUPABASE_SERVICE_ROLE_KEY` / `BLOG_PRIVATE_MEDIA_BUCKET` / `BLOG_ADMIN_ENABLED` / `BLOG_DB_WRITES_ENABLED` | 既存の BLOG 設定 |

## 適用の順序（いずれも事前承認が必要）
1. ステージングの BLOG DB に、次の順で適用する：`supabase/migrations/20261009180000_blog_ai_drafts.sql` → `20261010090000_blog_ai_followups.sql`。
2. プレビュー環境で確かめる：`BLOG_AI_DRAFTS_ENABLED=true` にして、通しで1記事を作り、承認と公開を確認する。
3. 本番：
   1. バックアップを確認する。
   2. 本番の BLOG DB にマイグレーションを適用する。
   3. デプロイする。
   4. `BLOG_AI_DRAFTS_ENABLED` を有効にする。
   5. （別の承認）定時の自動作成：`vercel.json` に `/api/cron/blog-ai-drafts` を追加し、`BLOG_AI_SCHEDULE_ENABLED=true` にする。

   - **マイグレーションはデプロイより前に適用する。** `lib/blog/catalogue.mjs` に新しいカテゴリーを加えたため、DB に無い状態で公開すると `/blog/categories` から 404 へのリンクができる。
   - マイグレーションを適用する前に AI 機能を有効にすると、新しいテーブルが無いため AI の API は失敗する。既存の公開処理への影響は無い。

## 本番 BLOG の稼働状況の確認（読み取り専用。実行は承認後）
**Vercel（名前と設定の有無だけ。値は見ない）**
1. Vercel の対象プロジェクト → Settings → Environment Variables を開く。
2. 検索欄に `BLOG` と入れる。
3. 次の変数が Production に**あるか**だけを記録する：`BLOG_SUPABASE_URL`、`BLOG_SUPABASE_ANON_KEY`、`BLOG_SUPABASE_SERVICE_ROLE_KEY`、`BLOG_PRIVATE_MEDIA_BUCKET`、`BLOG_ADMIN_ENABLED`、`BLOG_DB_WRITES_ENABLED`、`BLOG_AI_DRAFTS_ENABLED`。
   - 値を表示するボタン（目のアイコン）は押さない。
   - Edit も押さない。

**どの DB で実行するか**
- BLOG は、レース用 DB とは別の Supabase プロジェクトにある（`BLOG_SUPABASE_URL`）。
- Vercel の Production 環境の変数に `BLOG_SUPABASE_URL` があるかを、**名前だけ**確認する（値は表示しない）。
- 本番用の BLOG プロジェクトが無い場合、以下は実行しない。

本番の BLOG プロジェクトの SQL Editor で、1つずつ実行する（どれも参照だけ）。実行する前に、画面上部のプロジェクト名が BLOG 用であること（レース用ではないこと）を確かめる。結果は件数・名前・true/false だけを共有する。

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

## ステージングで試験する前に必要な準備（どれも事前承認が必要）
1. ステージングの BLOG プロジェクト（`docs/blog/PHASE12C.md` のもの）が使えることを確かめる。
2. 上の2本のマイグレーションを、ステージングの BLOG DB に適用する。
3. プレビュー環境の変数：`BLOG_AI_DRAFTS_ENABLED=true`、`OPENAI_API_KEY`（試験用の上限を設定したキーを推奨）。BLOG の既存変数は、ステージングのものを使う。
4. このブランチをプレビュー環境へデプロイする（Push が必要）。
5. 試験の手順：
   1. テーマを登録する。
   2. 公式情報を取得し、取得できる場か確かめる。
   3. AI で生成する。
   4. 確認：要修正を直して承認する。
   5. 承認後に1文字直し、公開ボタンが無効になることを確かめる。
   6. 再承認して公開する。
   7. 表紙を作り直す。
   8. 出典を登録する。
   9. 原稿を作る。
   10. 定時のエンドポイントは「無効」と返すことを確かめる。

## 検証済みと未検証
**検証済み**
- `node --test tests/blog/*.test.mjs`（リポジトリ直下から実行）：120件合格、失敗0、スキップ12（任意の HTTP テスト）。
  - DB：PGlite でマイグレーション4本を適用して確認。
  - 取得・生成・確認・承認：模擬の fetch・AI・ストアで確認。
  - 表紙：実際に PNG を生成して確認。
- `next build`：コンパイルは成功した。プリレンダーは、関係のない `/bsc2/admin/ai-dashboard`（Firebase の変数が無い）と `/library`（note.com に接続できない）で止まった（この作業環境の事情）。
- 管理画面 `/admin/blog/ai`：ローカルの開発サーバーで、画面の構成とスマートフォン幅で横スクロールしないことを確認した。DB 未接続の状態。
- 記事編集画面の「AI下書きの確認」「表紙とSNS・note原稿」：API の応答を模擬した一時的な確認ページで、表示を確認した。確認ページはコミットしていない。

**未検証**
- 実際の BLOG DB への接続。
- OpenAI の実際の呼び出し。
- 公式サイトからの実際の取得（この作業環境では boatrace.jp への通信が遮断されている）。
- 本番の Vercel 上での日本語フォントの描画。
