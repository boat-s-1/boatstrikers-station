# BoatStrikers BLOG 自律型記事生成システム — PHASE 0 監査報告書

- 確認日時：2026-11-03 11:30〜12:10 UTC（20:30〜21:10 JST）
- 監査ブランチ：`claude/boatstrikers-blog-audit-krge6t`（基点 `bfe2857` = 確認時点の main 最新）
- 監査方法：読み取りのみ。GitHub（ブランチ・PR・コミット）、リポジトリのコード、Supabase（本番 `rzosrbkyniyedolhkgxo`・BLOG ステージング `usieipnicxzzwgrzngtt`）への SELECT のみ。
- **変更していないもの**：本番 DB、ステージング DB、pg_cron、Vercel Cron、環境変数、公開設定、既存記事。秘密値は表示・記録していない。
- 「未確認」は、この監査環境から確認できなかった事項。推測で補完していない。

---

## 1. 結論（要約）

| 項目 | 状態 |
|---|---|
| BLOG 基盤（公開ページ・管理画面・会話ブロック・予約公開・SEO） | **実装済み・main にマージ済み（PR #265）・本番 DB に適用済み**。ただし **本番の公開記事は 0 件** |
| AI 下書きパイプライン（テーマ→公式情報取得→AI生成→自動検査→表紙→下書き保存→人の承認） | **実装済みだが未マージ**（`feature/blog-ai-drafts`、PR 未作成、最終コミット 2026-10-20）。ステージングのみ適用。**本番 DB には AI 用テーブルが無い** |
| 定時の自動生成 | **一度も動いていない**（ステージングの実行履歴 21 件はすべて `manual`）。`/api/cron/blog-ai-drafts` は `vercel.json` に未登録 |
| 自動公開 | **設計上禁止されている**（DB の `blog_release` が `BLOG_AI_APPROVAL_REQUIRED` で拒否）。今回の要件（品質ゲート合格で自動公開）とは方針が異なる |
| 自社レースデータの活用 | **未実装**。AI パイプラインの事実源は BOAT RACE 公式の場データページと `lib/stadiumBasicGuide24.js` の固定値のみ。`bs_race_*` は使っていない |
| Vercel Cron | **2026-10-25 11:14 UTC 前後から停止している可能性が高い**（根拠は 4 章）。pg_cron は正常稼働 |

**現在の完成度（目安）**：最終目標（毎日 1 本・自律運用）に対して **約 40〜45%**。
- 基盤（表示・編集・公開・予約・SEO・RLS）：約 90%
- AI 生成・検査（場テーマ限定）：約 60%
- 自社データ分析・テーマ自動選定（3 キャラ専門分野）：約 5%
- 品質ゲート 5 段（今回定義）：約 35%
- 毎日運用（状態管理・冪等・二重投稿防止・通知・停止スイッチ）：約 15%
- 自動公開・公開後監視：約 5%

（割合は各章の実装済み／未実装の項目数から見積もった目安で、計測値ではない。）

---

## 2. 停止原因と根拠

ブログ自動更新は「技術的に壊れて止まった」のではなく、**本番化の手順が途中（承認待ち）で止まったまま**である。加えて、定時実行の土台となる Vercel Cron が止まっている疑いがある。

| # | 停止原因 | 根拠（確認日時：2026-11-03 11:36〜12:05 UTC） |
|---|---|---|
| 1 | AI 下書きブランチが PR 化・マージされていない | GitHub：`feature/blog-ai-drafts`（SHA `d88508d`）は main より 23 コミット先行、PR 一覧（open）に該当なし。`git merge-base --is-ancestor` で未マージを確認。最終コミット 2026-10-20 01:45 UTC「PHASE 5.3 record and show official-source refresh results」 |
| 2 | AI 用マイグレーションが本番未適用 | 本番 `information_schema.tables`：`blog_%` は基盤の 12 表のみ。`blog_ai_drafts`・`blog_topics`・`blog_ai_runs` 等 8 表が無い。ステージングには 20 表ある |
| 3 | 定時生成が未登録・未有効化 | `vercel.json` に `/api/cron/blog-ai-drafts` が無い（`docs/blog/AI-DRAFTS.md` の方針どおり）。ステージング `blog_ai_runs.trigger` は `manual` 21 件のみ（成功 18・失敗 3、最終 2026-10-20 02:16 UTC） |
| 4 | 公開に人の承認が必須で、承認実績が 0 | ステージング `blog_ai_approvals` 0 件、`blog_ai_drafts.status` は 18 件すべて `needs_review`。`supabase/migrations/20261009180000_blog_ai_drafts.sql`（ブランチ側）180 行目 `blog_release` 内で `BLOG_AI_APPROVAL_REQUIRED` |
| 5 | 本番 BLOG は検証用 2 記事のみで、どちらも非公開 | 本番 `blog_posts`：`production-publication-check-20261007`・`production-scheduled-check-20261007`、いずれも `unpublished`。`blog_publication_events` 5 件（2026-10-07 の publish/unpublish/schedule/scheduled_publish/unpublish） |
| 6 | ステージングのマイグレーション履歴の番号がリポジトリと不一致（本番適用前の判断待ち） | ステージング `schema_migrations`：`20261009131746 blog_ai_drafts`・`20261009131756 blog_ai_followups`。リポジトリ：`20261009180000`・`20261010090000`。`docs/blog/AI-STAGING-PLAN.md` 7 章「承認されるまでは修正しない」 |
| 7 | Vercel Cron が停止している疑い（定時処理を Vercel に載せても動かない可能性） | 4 章の表。Vercel Cron だけが書き込むデータの最終更新が 2026-10-24〜25 で止まり、pg_cron 系は当日まで更新 |

**Vercel Cron 停止の直接の原因（プラン・設定・デプロイ状態など）は未確認**。Vercel ダッシュボード・ログにこの環境からアクセスできないため。

---

## 3. 既存実装の棚卸し

### 3-1. GitHub

| 対象 | 状態 | 根拠 |
|---|---|---|
| main 最新 | `bfe2857`（2026-10-31 頃、Discord 修正 #290） | `git log` |
| `feature/blog-media-platform` | **main にマージ済み**（PR #265、`50c54bb`）。BLOG PHASE 1〜12C | `git merge-base --is-ancestor` が真 |
| `feature/blog-ai-drafts` | **未マージ・PR なし**。109 ファイル、+13,651 行。main と衝突なし | `git diff --stat`、`git merge-tree --write-tree` exit 0 |
| `feature/blog-header-banner`・`blogmura-banner`・`blog-ranking-banner`・`footer-blog-navigation` | マージ済み（#266〜#269） | `git log origin/main` |
| BLOG 関連の open PR | なし（open PR 18 件のうち BLOG を扱うものは無い） | GitHub `list_pull_requests` |
| 既存設計書 | main：`docs/blog/PHASE1〜12C.md`、`phase10-editorial-review.md`。ブランチ：`docs/blog/AI-DRAFTS.md`、`AI-DRAFTS-GUIDE.md`、`AI-STAGING-PLAN.md`、`AI-QUALITY-REVIEW.md`、`AI-EVALUATION.md` | — |
| 本番環境との差分 | 本番サイトの実デプロイ SHA は**未確認**（Vercel 未接続・この環境から `boat-strike.online` へは CONNECT 403） | `curl` 結果 |

### 3-2. ブログ機能（main）

| 機能 | 状態 | 主なファイル |
|---|---|---|
| `/blog` トップ・検索（`?q=`、タイトル／抜粋の NFKC 一致） | 実装済み・本番は 0 件表示（記事 0 のため実データでの表示は**未検証**） | `app/blog/page.js`、`lib/blog/publicIndex.mjs` |
| 記事詳細 | 実装済み | `app/blog/articles/[slug]/page.js`、`app/blog/ArticleDetail.js`、`ArticleBlocks.js` |
| 著者別・カテゴリー・タグ | 実装済み | `app/blog/authors/*`、`categories/*`、`tags/*` |
| 記事作成・編集・自動保存・競合検出（409） | 実装済み | `app/admin/blog/*`、`lib/blog/autosave.mjs`、RPC `blog_save_draft` |
| 6 キャラクター会話（`DIALOGUE_SCENE`、人間 3＋AI MATE 3） | 実装済み | `lib/blog/dialogueScene.mjs`、`characterAssets.mjs`、`app/admin/blog/DialogueSceneEditor.js` |
| 公開・非公開・下書き・予約公開 | 実装済み。本番 2026-10-07 に手動・予約公開の実地確認済み（イベント 5 件） | RPC `blog_release`・`blog_change_state`・`blog_publish_due` |
| 予約公開ワーカー | 本番 pg_cron `blog-production-publish-due`（jobid 25、毎分、active）。直近 7 日 10,080 回すべて succeeded。anon/authenticated は実行不可、service_role のみ可 | `cron.job`、`cron.job_run_details`、`has_function_privilege` |
| SEO：title/description/canonical/OGP/noindex | 実装済み | `lib/blog/seo.mjs` |
| BlogPosting / BreadcrumbList | 実装済み（公開・期日到来・indexable のみ出力） | `lib/blog/seo.mjs` |
| Sitemap / robots | 実装済み（公開・indexable 記事のみ） | `app/sitemap.js` 60 行目、`app/robots.js` |
| 画像（非公開バケット） | 本番 `blog-drafts-production`（public=false）あり | `storage.buckets` |
| 本番の公開表示・Sitemap 反映・モバイル表示 | **未確認**（公開記事 0、サイトに接続不可） | — |

テスト（main、`node --test tests/blog/*.test.mjs`）：**89 合格・0 失敗・12 スキップ**（HTTP 統合テストはサーバー未起動のためスキップ）。2026-11-03 実行。

### 3-3. AI 生成機能（`feature/blog-ai-drafts`）

| 項目 | 内容 | 根拠 |
|---|---|---|
| API・モデル | OpenAI Responses API、JSON スキーマ strict、`reasoning.effort=low`、出力上限 12,000、90 秒タイムアウト。既定モデル `gpt-5.6-luna`（`BLOG_AI_MODEL`→`EDITORIAL_AI_MODEL`→`HATSUNE_NEWS_AI_MODEL`→既定） | `lib/blog/ai/openai.mjs` `callOpenAIJson`、`lib/blog/ai/config.mjs` `aiConfig` |
| プロンプト | `blog-ai-v14`。キャラ設定 `lib/blog/ai/personas.mjs`（一果・初音・キイナ、禁止語 `BANNED_PHRASES`） | `lib/blog/ai/prompt.mjs`、`config.mjs` `PROMPT_VERSION` |
| テーマ | 5 カテゴリー×24 場の固定候補（場の魅力・場の基本・場攻略・DATA LAB 1 件・キャラ巡り）。女子戦・5 号艇・高配当・初心者講座のテーマは**無い** | `lib/blog/ai/topics.mjs` `AI_CATEGORIES` |
| 事実源 | BOAT RACE 公式の場データページ（取得・SHA-256・取得日時を保存）と `lib/stadiumBasicGuide24.js` の固定集計値。**`bs_race_*` の自社データは使わない** | `lib/blog/ai/sourcePack.mjs`、`officialSources.mjs`、`officialStadiumData.mjs` |
| 自動検査 | 出典にない数値・出典なし数値ブロック・未登録 URL・禁止表現を「要修正」。類似タイトル・文字数等を「確認」。採点表（正確性・出典・重複・読みやすさ・キャラ・導入まとめ） | `lib/blog/ai/validate.mjs` `validateAiDocument`、`quality.mjs`、`scorecard.mjs` |
| 重複判定 | タイトルの文字バイグラム Dice 係数。0.8 以上で停止、0.6 以上で警告。意味的類似は**未実装** | `lib/blog/ai/topics.mjs` `similarity`、`pipeline.mjs` `DUPLICATE_STOP` |
| 保存 | `blog_create_draft` で下書き作成、来歴を `blog_ai_drafts`（model・prompt_version・source_pack・validation）へ | `lib/blog/ai/pipeline.mjs` `runDraftPipeline` |
| 失敗時 | 例外を `blog_ai_runs` に `failed` で記録（メッセージ 500 字）。同テーマは 24 時間再試行しない。15 分以内の `running` があれば見送り | `lib/blog/ai/schedule.mjs` `runScheduledDrafts` |
| 自動実行 | `GET /api/cron/blog-ai-drafts`（`CRON_SECRET` Bearer、`maxDuration=120`、1 回 1 件）。`BLOG_AI_DRAFTS_ENABLED` と `BLOG_AI_SCHEDULE_ENABLED` が両方 `true` のときのみ | `app/api/cron/blog-ai-drafts/route.js` |
| 承認 | 承認者名・セッションハッシュ・版・本文 md5 を追記専用で記録。保存で版が進むと承認無効 | `lib/blog/ai/approval.mjs`、SQL `blog_ai_approve`・`blog_ai_current_approval` |
| 派生原稿 | note・X・YouTube 原稿（自動投稿なし） | `lib/blog/ai/derivatives.mjs` |
| 戻し手順 | `ops/blog/ai-drafts-rollback.sql`（AI 表を `blog_ai_archive` へ退避） | — |
| ステージング実績 | 下書き 18（v1〜v14）、平均要修正 0〜11 件、承認 0、テーマ 4（すべて `stadium-basics`・`drafted`） | ステージング `blog_ai_drafts`・`blog_topics` |

テスト（ブランチ、ルート依存を一時導入して実行）：**291 合格・0 失敗・12 スキップ**。依存（`react`・`sharp`）が無い状態では 10 ファイルが `ERR_MODULE_NOT_FOUND` で失敗する（コードの不具合ではない）。2026-11-03 実行。

### 3-4. Supabase

**BLOG（本番 `rzosrbkyniyedolhkgxo`＝レース用 DB と同一プロジェクト）**
- 表 12：`blog_authors`・`blog_blocks`・`blog_categories`・`blog_media`・`blog_post_authors`・`blog_post_relations`・`blog_post_revisions`・`blog_post_tags`・`blog_posts`・`blog_publication_events`・`blog_tags`・`blog_templates`
- 関数 15：`blog_assert_publishable`、`blog_change_state`、`blog_check_revision_slots`、`blog_clone_revision`、`blog_create_draft`、`blog_editor_document`、`blog_guard_post`、`blog_guard_revision`、`blog_guard_revision_child`、`blog_media_is_published`、`blog_publish_due`、`blog_release`、`blog_save_draft`、`blog_validate_block_row`、`blog_validate_document`
- **`supabase_migrations.schema_migrations` に BLOG のマイグレーション記録が無い**（version 20261001〜20261010 の行が 0、name に blog を含む行 0）。表は存在するので、履歴を残さない方法（SQL Editor 等）で適用されたと考えられる。適用方法の記録は**未確認**。
- RLS・ポリシーの本番での詳細点検は今回**未実施**（関数権限 `blog_publish_due` のみ確認）。Security Advisor も未実行。

**連携候補の既存データ（本番、読み取り確認）**

| 表・ビュー | 期間 | 件数 | 備考 |
|---|---|---|---|
| `bs_race_events` | 2024-06-01〜2026-11-03 | 69,480 | `result_available` 68,837。`trifecta_payout` は 15,924 件のみ |
| `bs_race_results` | 2024-06-01〜2026-11-03 | 67,357 | `trifecta_payout` 66,595、`winning_technique`/`winning_method` 67,231、`trifecta_result` 66,789。**`first_boat` は 11,171 件のみ**。最終同期 2026-11-03 11:36 UTC |
| `bs_race_entries` | 2024-06-01〜2026-11-03 | 416,880 | `arrival_order` 94,300、`actual_course` 410,877。性別列（`sex_code`/`gender_code`/`gender`）は直近 365 日で 96,610 / 338,328 件のみ |
| `bs_race_result_entries` | 2024-06-01〜**2026-10-16** | 344,598 | **10-16 以降更新なし**。`finish_position` は 0 件、`arrival_order` 23,074 |
| `v_bs_race_results_confirmed` | 同上 | 69,480 | `effective_result_available`・`result_confirmation_reason` を持つ確定判定ビュー |
| `racer_gender_master` | — | 1,751 | 性別 1,751 件。女子戦判定の補助に使える |
| `stadium_yearly_stats` | 2025-08-05〜2026-08-04 | 1 行 | 期間固定・1 行のみ（全場分ではない） |
| `bsc_results` | 2026-07-11〜2026-11-03 | 6,673 | 自社予想の買い目と的中（`hit` 2,284）。**予想成績であり、レース結果ではない** |
| DATA LAB | `bs_data_lab_social_outputs`（29）、`bs_character_ai_analysis_metrics`（1,730）、`bs_ichika_ai_analysis_metrics`（3,256） | | 中身の意味は未精査 |
| TRINITY | `trinity_prediction_snapshots`（約 13,828）、`trinity_prediction_results`（約 13,388） | | 予想データ。記事の事実源にはしない |
| NEWS | `hatsune_news`（約 1,291）、`bs_news_candidates`（約 1,519）、`media_editorials`（約 587） | | 外部ニュース由来。出典・権利確認が必要 |

（件数は `count(*)`、「約」は `pg_class.reltuples` の推定値。）

**データ上の注意**（自社データ記事の正確性に直結）
1. 同じ情報が複数の表にあり、充足率が大きく違う（例：三連単払戻は `bs_race_results` が 99%、`bs_race_events` は 23%）。**事実源の表を固定して定義書を作る必要がある**。
2. `bs_race_result_entries` が 2026-10-16 から止まっている。原因は**未確認**。使うなら原因確認が先。
3. 1 着艇は `bs_race_results.first_boat` が 17% しか埋まっていない。`trifecta_result` の先頭や `bs_race_entries.arrival_order` から導くことになるが、どれを正とするかは**未定義**。
4. 女子戦の判定：レース名に「女子」等を含むのは直近 365 日で 5 件のみ。出走者の性別は列の充足が 29% で、`racer_gender_master` との結合が必要。**女子戦の定義（全員女子／シリーズ単位など）を決める必要がある**。

**BLOG ステージング `usieipnicxzzwgrzngtt`**：表 20、記事 24（published 4・draft 19・unpublished 1）、pg_cron `blog-staging-publish-due` 稼働中。

---

## 4. Cron 調査

### 4-1. Vercel Cron（`vercel.json`）
- 登録 20 件（elimination-odds-snapshots、trinity-shadow、trinity-previous-day-dispatch、media-editorials、news-morning-collect、data-lab-social、race-cancellations×2、news-verify×2、news-x-drafts×2、news-short-draft、news-editorials、daily-result-digest、x-night-candidates、x-night-posts、racer-master-sync、ichika-ai-analysis、hatsune-kiina-ai-analysis）。BLOG は無い。
- 認証：各 route が `CRON_SECRET` の Bearer を照合（例 `app/api/cron/blog-ai-drafts/route.js`）。Discord 系 5 本は `DISCORD_ALERTS_CRON_SECRET` 優先（`app/lib/discordAlertsCronAuth.js`）。値の設定有無は**未確認**（Vercel 未接続）。
- **稼働状況（間接確認）**：Vercel Cron だけが書くデータの最終更新

| データ | 対応する Vercel Cron | 最終更新（UTC） |
|---|---|---|
| `trinity_prediction_snapshots.inserted_at` | trinity-shadow（2 分毎） | 2026-10-25 11:14 |
| `bs_news_candidates.verified_at` | news-verify | 2026-10-25 09:10 |
| `media_editorials.generated_at` | media-editorials | 2026-10-25 09:10 |
| `bs_daily_result_digests.updated_at` | daily-result-digest | 2026-10-24 14:10 |
| `bs_data_lab_social_outputs.updated_at` | data-lab-social | 2026-10-24 21:20 |

一方、pg_cron 経由のデータは当日まで更新されている（`hatsune_news_cron_runs` 2026-11-03 05:00、`bs_news_candidates.collected_at` 2026-11-03 09:00、`bs_race_results` 同期 2026-11-03 11:36）。pg_net から Vercel の `/api/cron/discord-alerts` 等への呼び出しは直近 24 時間 437 件すべて HTTP 200 で、**デプロイ自体は応答している**。
→ **Vercel のスケジューラーだけが 2026-10-25 頃から止まっている可能性が高い**。停止理由（プラン、プロジェクト設定、Cron の無効化、デプロイ先の変更など）は**未確認**。Vercel ダッシュボードの Cron Jobs 画面と実行ログの確認が必要。

### 4-2. Supabase pg_cron（本番）
- 23 ジョブ、すべて active。BLOG は `blog-production-publish-due`（毎分、`begin; set local role service_role; set local statement_timeout='30s'; select public.blog_publish_due(20); commit;`、HTTP を使わない）。
- 直近 3 日の失敗：`ichika-escape-surge-line` 27 回（最終 2026-10-31 12:57 UTC）。BLOG 以外。
- pg_net で Vercel/Edge Function を呼ぶジョブあり（`discord-alerts` は Vault の秘密値を使用）。
- **リスク**：`boatstrikers-media-hourly`（jobid 12）のコマンドに Bearer 認証があり Vault を使っていない。コマンド文字列にトークンが直書きされている可能性がある（値は表示していない。キーの種類は**未確認**）。
- 二重実行：BLOG 予約公開は `FOR UPDATE SKIP LOCKED` とポインタの原子的クリアで冪等（`docs/blog/PHASE12C.md`、本番イベントでも重複なし）。

### 4-3. 新しい定時処理の載せ先（提案）
Vercel Cron の停止疑いと、Discord 系をすでに pg_cron＋pg_net に移した前例（#285〜#287）から、**BLOG 自動生成も pg_cron＋pg_net＋Vault の専用秘密値（例 `BLOG_AI_CRON_SECRET`）で Vercel の route を呼ぶ方式**を推奨。Vercel Cron と二重登録しない。

---

## 5. 要件との差分（未完成機能）

| PHASE | 要件 | 現状 | 判定 |
|---|---|---|---|
| 1 | 3 キャラの専門分野別テーマ（イン逃げ・女子戦・5 号艇/高配当） | 場テーマのみ。キャラ設定はあり | **未完成** |
| 1 | 候補複数生成・7 基準で評価・選定理由と使用データの記録 | 固定候補から日替わりで 1 件。評価なし | **未完成** |
| 2 | 自社確定データの集計（期間・母数・条件・根拠の保存） | 公式ページと固定値のみ | **未実装** |
| 2 | 記事構成 10 要素、定型の複製回避 | 既存構成（会話・DATA CHECK・WARNING・出典）あり。期間・母数の明示は公式データ範囲 | 一部 |
| 3 | GATE1 データ整合性（確定 DB と照合） | 出典パック内の数値照合のみ。DB 照合なし | 一部 |
| 3 | GATE2 独自性・重複（意味的類似、閾値検証） | タイトルのバイグラムのみ | 一部 |
| 3 | GATE3 有用性 | 採点表（補助指標）あり | 一部 |
| 3 | GATE4 SEO・技術 | SEO 生成はあるが、公開前の自動検査として独立していない | 一部 |
| 3 | GATE5 公開安全性 | 禁止表現・未登録 URL・出典 | 一部 |
| 3 | PASS/RETRY/HOLD 判定・最大 2 回再生成・DB 保存 | 要修正／確認の 2 区分。再生成ループなし | **未完成** |
| 4 | 毎日 1 本・3 キャラのローテーション | 1 回 1 件の仕組みのみ（未稼働） | **未完成** |
| 4 | 状態 10 種と遷移制御 | `blog_ai_drafts.status` 3 種、`blog_topics.status` 4 種 | **未完成** |
| 4 | JST 公開予定日の一意制約・ジョブ冪等・ロック | 15 分の実行中チェックのみ | **未完成** |
| 4 | HOLD・通知・次回を妨げない | 失敗記録のみ。通知なし | **未完成** |
| 5 | APPROVED のみ自動公開 | 人の承認必須（DB で強制） | **方針変更が必要** |
| 5 | 公開後検証（HTTP・canonical・構造化データ・Sitemap 等） | なし | **未実装** |
| 5 | 実行記録（コスト・トークン・処理時間・使用データ） | model・prompt_version・source_pack のみ | 一部 |
| 5/6 | 緊急停止（生成／公開の ON/OFF）を管理画面から | 環境変数のみ（再デプロイが必要） | **未実装** |
| 6 | 管理画面（履歴・品質・HOLD・API 利用量・再実行） | `/admin/blog/ai`（テーマ・公式情報・履歴）、記事編集の「AI下書きの確認」 | 一部 |
| 7 | AI 生成・検証方法の透明性表示 | 出典欄はあり。AI 生成である旨の表示は**未確認** | 一部 |

---

## 6. 再利用できる実装

| 再利用対象 | 用途 |
|---|---|
| main の BLOG 基盤一式（`lib/blog/*`、`app/blog/*`、`app/admin/blog/*`、RPC 群） | 表示・保存・公開・予約・SEO・Sitemap。変更せずに使う |
| `blog_publish_due` と pg_cron `blog-production-publish-due` | 自動公開の最終段（予約時刻に公開）。APPROVED 記事を `blog_release` で予約すれば既存ワーカーが公開する |
| `feature/blog-ai-drafts` の `openai.mjs`・`prompt.mjs`・`compose.mjs`・`validate.mjs`・`quality.mjs`・`scorecard.mjs`・`claims.mjs`・`cover.mjs`・`personas.mjs`・`approval.mjs`・`store.mjs` | 生成・文書変換・数値照合・採点・表紙・承認記録 |
| 同ブランチの表 `blog_ai_drafts`・`blog_ai_runs`・`blog_topics`・`blog_ai_approvals`・`blog_source_documents` | 来歴・実行履歴・テーマ・承認。状態管理表を追加して拡張 |
| 同ブランチのテスト基盤（PGlite、回帰記事の固定データ） | DB・品質ゲートの回帰テスト |
| `app/lib/discordAlertsCronAuth.js` の方式、Discord 管理者チャンネル通知（#284） | 定時実行の専用秘密値・HOLD 通知 |
| `v_bs_race_results_confirmed`、`bs_race_results`、`bs_race_entries`、`racer_gender_master` | 自社データ集計の事実源（定義書を作ってから） |

---

## 7. 修正・追加の対象ファイル（予定）

**既存の変更（最小限）**
- `feature/blog-ai-drafts` を main へ取り込む（PR）。衝突なし。
- `lib/blog/ai/topics.mjs`：キャラ専門分野のテーマ群を追加。
- `lib/blog/ai/pipeline.mjs`：処理を段階（企画→集計→生成→検査→承認→予約）に分け、各段を状態表で再開可能にする（120 秒制限対策）。
- `lib/blog/ai/validate.mjs`：数値照合を「集計結果（DB 由来の証拠）」にも広げる。
- `lib/blog/ai/sourcePack.mjs`：自社集計の出典種別を追加。
- `app/admin/blog/ai/*`：停止スイッチ・HOLD 一覧・ゲート詳細・コスト表示。

**新規（予定）**
- `lib/blog/ai/datasets/*.mjs`：確定データの集計定義（SQL は読み取り専用の固定クエリ、期間・母数・条件を出力）。
- `lib/blog/ai/gates/*.mjs`：GATE1〜5 と PASS/RETRY/HOLD 判定。
- `lib/blog/ai/jobs.mjs`：日次ジョブの状態遷移・冪等・ロック。
- `lib/blog/ai/postcheck.mjs`：公開後検証。
- `app/api/cron/blog-daily/route.js`：段階ごとの入口（専用秘密値）。
- `supabase/migrations/<新番号>_blog_ai_daily_jobs.sql`：下記 8 章。
- `ops/blog/blog-daily-cron.sql`：pg_cron 登録（**承認後に手で適用**、作成時は inactive）。

---

## 8. 必要な DB 変更（案。今回は作成も適用もしていない）

すべて BLOG 専用オブジェクトの追加のみ。既存のレース用・BLOG 基盤の表と権限は変えない。

1. **前提**：`feature/blog-ai-drafts` の 2 本（`20261009180000_blog_ai_drafts.sql`・`20261010090000_blog_ai_followups.sql`）を本番へ。その前に「ステージングの履歴番号の不一致」と「本番に BLOG 基盤の履歴が無いこと」をどう扱うか決める。
2. `blog_ai_jobs`（新規）：`publish_date date`（JST）に **一意制約**、`character_key`、`state`（PLANNED/GENERATING/GENERATED/VALIDATING/RETRY/APPROVED/PUBLISHING/PUBLISHED/HOLD/FAILED）、`attempt`（≤2 回の再生成）、`post_id`、`lease_owner`・`lease_until`（ロック）、`hold_reason`、時刻列。
3. 状態遷移関数（SECURITY INVOKER、service_role のみ実行）：許可された遷移以外を例外にする。`FOR UPDATE SKIP LOCKED` でリース取得。
4. `blog_ai_gate_results`（新規、追記専用）：job・版・ゲート番号・判定・詳細 JSON・入力のハッシュ。
5. `blog_ai_datasets`（新規）：集計定義 ID・バージョン・期間・母数・条件・結果 JSON・SQL ハッシュ・取得時刻。記事の数値の根拠。
6. `blog_ai_runs` に列追加：トークン数・推定コスト・処理時間（null 可）。
7. `blog_ai_settings`（新規、1 行）：`generation_enabled`・`auto_publish_enabled`・`publish_time`（既定 06:00 JST）・ローテーション設定。管理画面から切り替え、**再デプロイなしで停止**できるようにする。
8. **自動承認の扱い（要判断）**：現在 `blog_release` は人の承認を必須にしている。自動公開するには、(a) 全ゲート PASS を「システム承認」として `blog_ai_approvals` に記録できるようにする（承認者種別 `system`、ゲート結果のハッシュを保存）か、(b) 自動公開は行わず、人が毎日承認する運用にするか、を決める必要がある。(a) は `blog_release` の差し替えを伴うため、再度の互換性テストが必要。

---

## 9. 必要な環境変数（名前のみ。値は扱わない）

| 変数 | 用途 | 状態 |
|---|---|---|
| `BLOG_SUPABASE_URL`・`BLOG_SUPABASE_ANON_KEY`・`BLOG_SUPABASE_SERVICE_ROLE_KEY`・`BLOG_PRIVATE_MEDIA_BUCKET`・`BLOG_ADMIN_ENABLED`・`BLOG_DB_WRITES_ENABLED` | 既存の BLOG 設定 | 本番の設定有無は**未確認**（2026-10-07 の本番検証記事があるため、少なくとも当時は設定されていたと考えられる） |
| `BLOG_AI_DRAFTS_ENABLED` | AI 機能 | 本番**未確認**（未設定の想定） |
| `OPENAI_API_KEY`・`BLOG_AI_MODEL` | 生成 | 既存キーの有無は**未確認** |
| `BLOG_AI_SCHEDULE_ENABLED` 他 | 既存の定時設定 | 新方式では DB の設定表に置き換え予定 |
| `BLOG_AI_CRON_SECRET`（新規・案） | pg_cron→Vercel の専用認証。Vault にも同じ値 | 未作成 |
| `BLOG_AI_DAILY_BUDGET_USD`（新規・案） | 1 日の API 費用上限 | 未作成 |

---

## 10. 本番運用までの実装計画

各段の終わりで報告し、承認を得てから次へ進む。

| 段 | 内容 | 本番への影響 | 工数目安 |
|---|---|---|---|
| A | **事前確認（ユーザー作業・読み取りのみ）**：Vercel の Cron Jobs 画面と停止理由、本番デプロイ SHA、BLOG 系環境変数の有無、jobid 12 のトークン直書きの有無 | なし | 0.5 日 |
| B | `feature/blog-ai-drafts` を main に取り込む PR（機能は無効のまま）。マイグレーション履歴番号の方針決定 | コードのみ。AI 機能は無効 | 1 日 |
| C | 自社データの**集計定義書**と読み取り専用の集計モジュール（イン逃げ率・女子戦・5 号艇 1 着・高配当）。事実源の表と確定条件を固定し、既存の DATA LAB 数値と突き合わせて検証 | なし（読み取りのみ） | 3〜4 日 |
| D | テーマ候補生成と評価（7 基準）、3 キャラのローテーション | なし | 2 日 |
| E | 品質ゲート 1〜5、PASS/RETRY/HOLD、再生成 2 回まで、結果の DB 保存。類似度の閾値を既存記事・ステージング下書きで検証（意味的類似は埋め込みを使うか要判断） | なし | 4〜5 日 |
| F | 日次ジョブの状態表・冪等・ロック・設定表（停止スイッチ）・段階実行 route・管理画面 | なし（ステージングで検証） | 3〜4 日 |
| G | ステージングで隔離テスト（正常系・異常系、8 章のすべての失敗パターン） | ステージングのみ | 2 日 |
| H | ステージングで **7 日間連続運転**（生成→検査→下書き保存まで。公開しない） | ステージングのみ | 7 日（監視は 1 日 30 分程度） |
| I | 本番 DB へ追加マイグレーション（バックアップ確認後）・本番 pg_cron を inactive で作成 | 本番 DB（追加のみ） | 0.5 日 |
| J | 本番で下書き生成のみ有効化 → 人が確認 | 本番で下書きが作られる | 3〜7 日 |
| K | 限定自動公開（例：週 2〜3 本、人が公開後確認）→ 公開後検証・通知 | 本番公開 | 1〜2 週 |
| L | 明示的承認の後、毎日自動公開。継続監視 | 本番公開 | — |

開発工数の合計（A〜G）：**約 15〜19 人日**＋検証期間（H・J・K で 3〜4 週間）。

**時刻の調整案**（JST）：前日結果の取得ジョブが 00:10・00:30・01:00、データ欠損確認が 01:10 に動いているため、**集計は 01:30 以降**にする。案：01:30 集計 → 01:45 テーマ選定 → 02:00 生成 → 02:15 検査 → 02:30〜03:30 再生成・再検査 → 03:45 承認判定と 06:00 の予約 → 06:00 既存ワーカーが公開 → 06:15 公開後確認。

---

## 11. リスク

| リスク | 影響 | 対策 |
|---|---|---|
| BLOG がレース用本番 DB と同じプロジェクトにある | BLOG の変更・負荷がレース機能に波及しうる | 追加のみのマイグレーション、集計は読み取り専用・時間帯と上限を設定、statement_timeout |
| 本番に BLOG の migration 履歴が無い | 今後の `db push` 等で誤判定 | 適用方法を確認し、履歴の扱いを文書化してから次を適用 |
| Vercel Cron 停止の疑い | Vercel Cron に載せた処理が動かない／既存機能が止まっている | Vercel 側の確認（段 A）。BLOG は pg_cron＋pg_net |
| AI の誤った数値 | 誤情報の公開 | GATE1 で DB 集計結果と機械照合。AI に数値を作らせず、集計値を渡して引用させる |
| 自社データの欠損・表ごとの不一致 | 集計値の誤り | 集計定義書で事実源を固定、充足率が基準未満なら HOLD |
| 自動公開による品質低下・量産 | 検索評価・AdSense 審査への悪影響 | ゲート必須、HOLD 優先、公開頻度は限定から開始、AI 生成と検証方法を明示 |
| Vercel の実行時間上限（route は 120 秒設定） | 生成の途中終了 | 段階実行と状態表による再開 |
| API 費用 | 想定外の請求 | 1 日上限、トークン記録、上限超過で HOLD |
| 承認の方針変更（人→システム） | 既存の安全装置を弱める | 8 章の判断を明示的に承認してもらう。人の承認経路は残す |
| jobid 12 のトークン直書きの可能性 | 秘密値の露出 | 段 A で確認、Vault へ移す（BLOG とは別件） |

---

## 12. テスト計画

1. **単体**：集計定義（固定データで期待値一致）、ゲート判定（各ゲートの PASS/RETRY/HOLD 境界）、状態遷移（不正遷移の拒否）、JST 日付境界（23:59/00:00 JST、UTC との差）。
2. **DB（PGlite）**：一意制約による二重投稿防止、リースの同時取得、`blog_release` の承認チェック（人／システム）、既存の BLOG 基盤テスト 89 件と AI テスト 291 件の回帰。
3. **異常系**：数値不一致→HOLD、出典不足→HOLD、重複記事→HOLD、AI API 失敗（タイムアウト・400・不正 JSON）→RETRY→FAILED、DB 接続失敗、Cron 二重起動、途中停止からの再開、公開スイッチ OFF 中の公開要求拒否、権限なしの公開要求拒否。
4. **ステージング統合**：pg_cron→pg_net→Preview route の実行、7 日間の連続運転で日次 1 本・状態・記録・通知を確認。
5. **公開後**：HTTP 200、本文、canonical、noindex、BlogPosting/BreadcrumbList、Sitemap、画像、内部リンク、モバイル幅（Playwright）。
6. **既存機能の非破壊**：NEWS・DATA LAB・TRINITY・手動ブログ編集の画面と Cron が変わらないこと。

---

## 13. 不足情報（確認をお願いしたいこと）

1. Vercel：Cron Jobs 画面の状態と、2026-10-25 以降に止まっている理由。本番デプロイの SHA。
2. Vercel Production の環境変数のうち、`BLOG_*`・`OPENAI_API_KEY`・`CRON_SECRET` が**あるかどうか**（値は不要）。
3. 自動公開の方針：品質ゲート全合格を「システム承認」とするか、人の承認を残すか（8 章 8）。
4. 女子戦の定義、高配当の基準額（例：三連単 1 万円以上）、集計期間の標準（例：直近 365 日）。
5. AI モデル：既存の OpenAI（`gpt-5.6-luna`）を続けるか。1 日あたりの費用上限。
6. HOLD 通知の送り先（既存の Discord 管理者チャンネルでよいか）。
7. `bs_race_result_entries` が 2026-10-16 から更新されていない件は意図したものか。

---

## 14. 今回の作業記録

- 実行した SQL：すべて `SELECT`（`information_schema`・`pg_proc`・`cron.job`・`cron.job_run_details`・`net._http_response` の集計・`storage.buckets`・`supabase_migrations.schema_migrations`・各データ表の件数と期間）。
- 書き込み・DDL・Cron 変更・環境変数変更：**なし**。
- テスト実行：ローカルのみ。ブランチのテスト用に一時ディレクトリへルート依存を導入（リポジトリには追加していない）。
- 次の PHASE には進んでいない。**PHASE 1 以降の実装は承認待ち**。
