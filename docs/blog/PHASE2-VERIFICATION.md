# BLOG 自律運用 PHASE 2：実データ検証・公開安全性監査

- ブランチ：`claude/boatstrikers-blog-audit-krge6t`（PR #295）
- 本番 DB・本番 Cron・環境変数・main は変更していない。ステージング（`usieipnicxzzwgrzngtt`）にのみ、承認を得てマイグレーションを適用した。
- **OpenAI API キーはこの作業環境に無い**。AI による記事生成は実行していない。AI の応答を使う検証はすべて「模擬応答」で行い、そう明記する。

## 1. ステージング検証（STEP 1）

### 1-1. 適用前（2026-11-03 12:26 UTC、読み取りのみ）
- 記事 24（published 4・draft 19・unpublished 1）、予約 0、公開履歴 17、AI 承認 0。記事の状態の md5 `52b5967d…`。
- 予約公開 Cron `blog-staging-publish-due`：直近 24 時間 1,440 回すべて成功。
- 置き換え・再定義する関数の本文がリポジトリ版と一致：`blog_release` `f3eed473…`、`blog_publish_due` `186a6029…`、`blog_ai_current_approval` `7951fc21…`（PGlite で 4 本のマイグレーションを適用した値と一致）。マイグレーション冒頭でもこの 3 つの md5 を確認し、違えば何も変えずに止まる。

### 1-2. 適用（2026-11-03 12:41 UTC）
- `supabase/migrations/20261103120000_blog_ai_quality_gates.sql`（sha256 `00c838cb…598b`）の内容を SQL で実行し、履歴をリポジトリと同じ版番号 `20261103120000` で `supabase_migrations.schema_migrations` に記録した（PHASE 0 で指摘した「履歴の番号ずれ」を繰り返さないため）。
- 適用後（12:42 UTC）：BLOG の関数 32 個の本文と `blog_ai*` 表の制約の md5 が、PGlite で同じファイルを適用した結果と完全に一致（関数 `0adbe0e2…`、制約 `d1189725…`）。記事の状態の md5・公開履歴の件数は適用前と同じ。設定は `manual`・自動公開 OFF・生成 OFF・公開時刻 06:00。

### 1-3. 動作テスト（`ops/blog/ai-quality-gates-behavior-test.sql`）
実行前に確認したこと（2026-11-03 12:48 UTC、読み取りのみ）：
- 接続先はステージング：レース用の表が無い、Cron は `blog-staging-publish-due` の 1 件だけ。スクリプト冒頭でもレース用の表があれば止まる。
- 単一トランザクション：DO ブロック 1 文で COMMIT を含まず、最後に必ず例外を出す。正常終了・例外・タイムアウト・切断のいずれでも全体が取り消される。
- 取り消されない副作用が無い：連番（sequence）を使う列なし、外部通信をするトリガーなし、Realtime の配信対象なし。Cron・認証情報には触れない。既存記事に予約があれば止まる（テスト内の予約公開ワーカーが既存記事に触れないように）。

PGlite では 14/14 合格・全取り消しを確認。**ステージングでの実行結果：（実行待ち。Supabase の実行確認に回答が無くタイムアウトしたため、未実行）**

### 1-4. RLS・権限
PGlite と動作テストの項目 13 で確認：新しい表 4 つ（設定・検査結果・自動公開・日次ジョブ）は RLS 有効・anon/authenticated の権限なし。新しい関数と `blog_publish_due` は service_role だけが実行できる。

## 2. 品質ゲートの迂回防止（STEP 3）

PHASE 1 の時点で残っていた迂回経路と対策：

| 経路 | PHASE 1 | PHASE 2 の対策 | 確認 |
|---|---|---|---|
| システム承認済みの記事を予約 → 自動公開を停止 → 予約公開ワーカーが公開 | 公開されていた | `blog_publish_due` が `blog_ai_release_allowed` で確認し、許されない予約は**スキップ**（他の記事の予約公開は止めない） | PGlite・動作テスト 7, 8 |
| HOLD 判定の版を人が承認して公開・予約 | できた | 承認された版の最新の判定が HOLD なら、人の承認でも公開・予約不可 | PGlite・動作テスト 4 |
| 権限のあるロールによる `blog_posts` の直接更新 | 制限なし | トリガー `blog_ai_guard_publication` が公開・予約の列の変更を必ず検査 | PGlite・動作テスト 5 |
| 自動公開の二重実行（同じ日に 2 本） | アプリ側の確認だけ（競合あり） | `blog_ai_auto_publications` の主キー（JST の日付）で 1 日 1 本。2 本目は取り消し | PGlite・動作テスト 10 |
| 承認と公開の間の本文変更 | 公開時に md5 照合 | 自動公開は承認と公開を 1 トランザクションで行い、本文の md5 が違えば何も残さない | PGlite・動作テスト 9 |
| 日次処理の二重起動 | 15 分の実行中チェック（アプリ側） | `blog_ai_jobs` の日付ごとの行とリース。許可された状態遷移のみ | PGlite・動作テスト 11・単体テスト |

異常系の単体テスト（`tests/blog/aiDaily.test.mjs` ほか、模擬応答）：数値改ざん → HOLD、出典不足 → PASS にならない、類似記事（同じ集計・本文類似）→ HOLD、データ欠損・不足 → AI を呼ばずに HOLD、AI API エラー → FAILED（下書きなし）→ 次の実行で再開（再開は 2 回まで）、二重実行 → 2 本目は何もしない、公開直前の本文変更 → 拒否、自動公開 OFF → 承認済みの下書きで止まる、緊急停止 → DB が拒否し FAILED。

追加で見つかった検査の抜け：研究記事で、集計値から計算した数値（例「8レースに1回」）が素通りしていた（既存の検査は「1〜12＋レース」をレース番号とみなすため）。研究記事では単位（レース・件・%・円・倍）の付いた数値がすべて集計値か集計期間の数字であることを確かめ、そうでなければ HOLD にした。

## 3. 実データ集計と SQL の照合（STEP 2）

### 3-1. 方法
1. `ops/blog/ai-real-data-verification.sql`：レース単位の規則と集計を、コード（`raceQuality.mjs`・`datasets.mjs`）とは独立に SQL で実装したもの。読み取りのみ。
2. 合成データ（規則が扱う欠損・不整合すべてを含む）で、SQL とコードの集計が完全に一致することをテストで確認（`tests/blog/aiRealDataSql.test.mjs`、場指定・全国の両方）。
3. `ops/blog/ai-real-data-export.sql` で本番の確定データを読み取り専用で書き出し、`scripts/blog/verify-real-data.mjs` でコードの集計を実行し、同じ期間・対象の SQL の結果と比較する。書き出し・復元で集計が変わらないことも合成データで確認済み。
4. 研究記事の重要な数値（集計レース数・該当件数・割合・中央値）を SQL の結果と照合する。

**結果：（実行待ち）**

### 3-2. 研究記事の品質ゲート検証（模擬応答）
**結果：（実行待ち）** 一果（イン逃げ）・初音（女子戦）・キイナ（5号艇1着・高配当）の各記事について、実データの集計から作った出典パックと模擬応答で、7 ゲートの判定を確認する。AI による生成ではない。

## 4. Cron 方式の比較（STEP 4）

Vercel Cron の停止原因は**未確定**として扱う（PHASE 1 の調査：Vercel Cron だけが書くデータが 2026-10-25 11:14〜14:10 UTC の間に一斉に更新停止。pg_cron の処理と、pg_net から Vercel の route への呼び出しは正常）。

| 観点 | Vercel Cron | pg_cron ＋ pg_net（推奨） |
|---|---|---|
| 現在の稼働 | 10-25 以降、停止の疑い（原因未確定） | 稼働中（BLOG 予約公開・Discord 通知・NEWS・前日結果） |
| 起動の確認 | Vercel のログ（この環境から見られない） | `cron.job_run_details`、`net._http_response`、`blog_ai_runs`、`blog_ai_jobs` を SQL で確認できる |
| 認証 | 共有の `CRON_SECRET`（TRINITY・NEWS・DATA LAB と共用） | BLOG 専用の `BLOG_AI_CRON_SECRET`（Vault に保存）。BLOG だけを止める・入れ替えることができる |
| 停止 | `vercel.json` の変更と再デプロイ | `cron.alter_job(active := false)`、加えて `blog_ai_settings`（再デプロイ不要） |
| 二重起動 | 設定次第で重複 | 同名ジョブ 1 件＋`blog_ai_jobs` のリース＋1 日 1 本の主キー |
| 失敗の扱い | 失敗の記録がアプリ任せ | `blog_ai_jobs` の状態と `last_error`、`blog_ai_runs`。FAILED は次の実行で最大 2 回再開 |
| 注意点 | 停止の原因が分からないまま追加すると、同じ理由で動かない | pg_net は非同期で、応答の待ち時間（`timeout_milliseconds`）を 120 秒程度に明示する必要がある。秘密値は Vault に置き、ジョブのコマンドに直接書かない |
| 安全性 | 中（共有の秘密値） | 高（専用の秘密値、DB 側で状態を強制） |
| 運用性 | 低（停止中・原因不明） | 高（SQL だけで状態・履歴・停止ができる） |

**推奨**：BLOG の日次処理は pg_cron ＋ pg_net で `/api/cron/blog-ai-daily` を呼ぶ。Vercel Cron には登録しない。予約公開は今の DB 内 Cron のまま。

### 4-1. 既存の TRINITY・NEWS・DATA LAB への影響
- **秘密値**：BLOG は `BLOG_AI_CRON_SECRET` だけを使い、`CRON_SECRET` には触れない。BLOG の秘密値を入れ替えても他の処理に影響しない。
- **時間帯**：本番の pg_cron は 15:10〜16:30 UTC（00:10〜01:30 JST）に前日結果の取得・欠損確認・前日の健全性確認が集中している。BLOG の日次処理は、欠損確認（01:10 JST）のあとで、16:30 UTC のジョブとも重ならない **01:40・02:10・02:40・03:10・03:40 JST**（16:40〜18:40 UTC）に呼び、公開は **06:02 JST**（21:02 UTC）にする。この時間帯は本番の他の pg_cron ジョブと重ならない（毎週日曜 19:00 UTC の engine-v3 を除く。BLOG は 18:40 UTC で終わる）。
- **DB 負荷**：研究記事 1 本の読み取りは、場ごと 365 日で約 2,300 レース分（出走表 約 14,000 行、1,000 行ずつ約 20 回）、全国 90 日で約 13,500 レース分（出走表 約 81,000 行、約 110 回）。1 日 1 本・夜間のみ。表ごとに 150,000 行で止める。
- **データの依存**：研究記事は前日までの確定結果だけを使い、前日結果の取得ジョブ（00:10・00:30・01:00 JST）のあとに集計する。結果の取得が遅れた日は、カバー率の基準（95%）に届かず HOLD になる（推測では埋めない）。
- **Vercel への依存**：pg_net から呼ぶ先は Vercel の route なので、Vercel のデプロイ自体が止まれば BLOG の日次処理も止まる（スケジューラーとしての Vercel Cron には依存しない）。

## 5. 7 日間連続運転の試験計画（STEP 5）

### 5-1. 目的と範囲
毎日 06:00 JST 公開を目標とする運用を、**生成・品質検証・下書き保存まで**、7 日間連続で確かめる。**自動公開は OFF のまま**（`approval_mode='manual'`・`auto_publish_enabled=false`）。

### 5-2. 開始前に必要なこと（いずれも別途承認が必要。今回は実施していない）
1. ステージングでの動作テスト（1-3）と実データの照合（3）の合格。
2. PR #295 のブランチの Preview 環境（ブランチ限定）に設定する環境変数：`BLOG_SUPABASE_*`（ステージング）、`BLOG_PRIVATE_MEDIA_BUCKET`、`BLOG_AI_DRAFTS_ENABLED=true`、`OPENAI_API_KEY`（上限付きの試験用を推奨）、`BLOG_AI_CRON_SECRET`、`BLOG_RACE_DATA_SUPABASE_URL`・`BLOG_RACE_DATA_SUPABASE_KEY`（本番レース DB を**読み取りだけ**できるキー）。
3. Preview の保護を回避するトークン（Vercel のデプロイ保護がある場合）。
4. ステージング DB の `blog_ai_settings.generation_enabled=true`（自動公開は OFF のまま）。
5. ステージング DB の pg_cron に `blog-ai-daily-staging` を **inactive** で作成し、確認後に active にする。呼び出し時刻は 4-1 の 01:40〜03:40 JST。秘密値は Vault。

### 5-3. 毎日確認すること
| 項目 | 確認方法 | 合格の基準 |
|---|---|---|
| ジョブの状態 | `select * from blog_ai_jobs order by publish_date desc` | その日のジョブが 03:40 JST までに APPROVED か HOLD。FAILED のまま残らない |
| 二重実行 | `blog_ai_jobs.history`、`blog_ai_runs` | 1 日 1 ジョブ、生成は最大 3 回（初回＋作り直し 2 回） |
| 担当キャラ | `blog_ai_jobs.character_key` | 一果 → 初音 → キイナの順 |
| データの照合 | その日の集計（`source_pack.datasets`）を `ai-real-data-verification.sql` で同じ期間・対象で集計し比較 | 母数・集計数・除外の内訳・指標がすべて一致 |
| 品質ゲート | `blog_ai_gate_results` | PASS 以外は公開候補にならない。HOLD の理由が妥当 |
| 公開されていないこと | `blog_publication_events`、`blog_ai_auto_publications` | 試験期間中 0 件 |
| 記事の中身 | 管理画面で人が読む | 数値・期間・母数・注意点が正しく、誇張がない |
| 費用 | OpenAI の利用画面 | 1 日あたりの上限内（トークン数の記録は未実装。下記） |
| 既存の処理 | 予約公開 Cron・本番の TRINITY / NEWS / DATA LAB | 影響なし |

### 5-4. 合格の条件
- 7 日連続で、その日のジョブが APPROVED か HOLD で終わる（FAILED が残らない）。
- 二重実行・二重の下書き・公開が 0 件。
- 集計の数値が SQL と 7 日分すべて一致。
- 人が読んで、APPROVED の記事に事実の誤りが無い（誤りがあれば、その原因の検査を追加してからやり直す）。

### 5-5. 止め方
`update blog_ai_settings set generation_enabled=false`（即時）→ `cron.alter_job(..., active := false)`。記事・履歴は消さない。

### 5-6. 未対応（試験の前に直すか、試験中に記録する）
- AI のトークン数・推定費用の記録（`blog_ai_runs` に列がない）。
- 管理画面の停止スイッチ・HOLD 一覧・ゲート詳細の表示（PHASE 6）。
- HOLD・FAILED の通知（既存の管理者向け Discord 通知への接続）。
