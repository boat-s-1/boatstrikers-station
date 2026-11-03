# BLOG 自律運用 PHASE 1：データ品質ゲート・テーマ拡張・自動公開の設計

- 作業ブランチ：`claude/boatstrikers-blog-audit-krge6t`（`feature/blog-ai-drafts` を取り込み済み。main へのマージはしていない）
- 調査日時：2026-11-03 11:36〜12:15 UTC（本番 `rzosrbkyniyedolhkgxo` への SELECT のみ）
- **本番 DB・本番 Cron・環境変数・公開設定は変更していない。自動公開は初期状態で OFF。**

## 1. 今回入れたもの

| 項目 | ファイル | 本番への影響 |
|---|---|---|
| `feature/blog-ai-drafts` の取り込み（衝突なし） | マージコミット | なし（AI 機能は既定で無効のまま） |
| レース単位のデータ品質ゲート | `lib/blog/ai/data/raceQuality.mjs` | なし |
| 3キャラの研究データ集計（イン逃げ・女子戦・5号艇1着・高配当） | `lib/blog/ai/data/datasets.mjs` | なし |
| レースデータの読み取り（SELECT のみ、専用変数・未設定なら停止） | `lib/blog/ai/data/reader.mjs`、`lib/blog/ai/server.js` `raceDataReader` | なし（変数は未設定） |
| 研究テーマの出典パックとパイプラインの分岐 | `lib/blog/ai/data/researchPack.mjs`、`lib/blog/ai/pipeline.mjs` | なし |
| テーマ拡張（既存の24場テーマは維持） | `lib/blog/ai/topics.mjs` | なし（カテゴリーは既存の `inside-course`・`beginner`・`women`・`longshot` を使う。DB 行の追加なし） |
| 過去記事との重複判定（タイトル・本文・同じ集計） | `lib/blog/ai/duplicates.mjs` | なし |
| 自動品質検証 7 ゲート（PASS / RETRY / HOLD） | `lib/blog/ai/gates.mjs` | なし |
| 自動承認モード（初期 OFF）と検査結果の記録 | `supabase/migrations/20261103120000_blog_ai_quality_gates.sql` | **未適用** |
| 自動公開の手順（どの Cron にも未登録） | `lib/blog/ai/autoPublish.mjs`、`lib/blog/ai/store.mjs` | なし |
| 戻し手順 | `ops/blog/ai-quality-gates-rollback.sql` | なし（未実行） |
| テスト | `tests/blog/aiRaceData`・`aiGates`・`aiDuplicates`・`aiThemes`・`aiAutoPublish`・`aiResearchPipeline`・`aiQualityGatesDatabase` | — |

## 2. データ品質の調査結果（本番、読み取りのみ）

### bs_race_results（結果の正）
- 67,357 行、レースごとの重複 0。`result_status`/`race_status` は `finished`/`completed`、`confirmed`/`finished` などの組み合わせ。
- `trifecta_result` は「1-2-3」形式と「123」形式が混在（2,534 行が「123」形式）。正規化すると `winning_trifecta`・`first_boat`・`bs_race_events.trifecta` と食い違いは 0。
- **「000」が 19 行**（着順なし）。→ `invalid_trifecta` で除外。
- 決まり手は全角スペースで埋められている（例「逃げ　　　」）。**空白だけの値が 714 行、null が 126 行**。→ 空白を除いて 6 種（逃げ・差し・まくり・まくり差し・抜き・恵まれ）以外は `technique_missing`。
- 払戻金：66,595 行にあり、0 以下はなし（100〜820,900 円）。`bs_race_events.trifecta_payout` とある分はすべて一致。
- `first_boat` は 11,171 行しか入っていない → 1着艇は `trifecta_result` から読み、`first_boat` があるときは一致を確認する。

### bs_race_events
- `race_status` は当てにならない（結果があるのに `scheduled` の行が 64,730）。判定には使わない。
- 中止・順延の記録：`race_cancel_code` が `official_cancelled` 15・`weather_postponed` 12・`1` 2。うち 2 件は結果行もある → `cancelled` で除外。

### bs_race_entries
- 直近 365 日の結果 53,826 レースはすべて 6 艇そろっている。`actual_course` が 6 艇とも異なる値でそろうのは 53,262 レース。
- 1着艇の `arrival_order` があるとき、3連単と食い違いは 0。
- `actual_course` は `bs_race_result_entries.entry_course` と 326,174 件で一致・食い違い 0。
- 決まり手と1着艇の進入コース：「逃げ」はすべて 1 コース、「差し・まくり・まくり差し」は 1 コース以外。この関係が崩れたレースは `technique_course_conflict` で除外する。
- **登録番号が「4794」と「04794」の 2 形式で入っている**（365 日で 3,249 種類 → 先頭の 0 を除くと 1,646 人）。

### racer_gender_master
- 1,751 人（女性 307・男性 1,444）、ID の重複なし。`racer_id` は整数。
- 先頭の 0 を除いて照合すると、365 日の出走選手 1,646 人のうち 1,641 人がマスタにある。出走表の `gender_code` とマスタの性別の食い違いは 0。
- 6 艇すべてが女性のレース（女子戦）は 365 日で 4,785 レース。マスタにない選手を含むレースは 14 レース → **推測せず `gender_unknown` で除外**（女子戦かどうか分からないので、カバー率の分母には入れる）。

### bs_race_result_entries
- 2026-10-16 から更新されていない。`finish_position` は 0 件。**今回の集計には使わない。**

## 3. データ品質ゲートの規則

レースごとに次を確かめ、集計に必要な項目に問題があるレースは理由付きで除外する。埋め合わせ・推測はしない。

| グループ | 除外理由 | 使う集計 |
|---|---|---|
| 結果 | 結果なし／状態が確定でない／中止・順延／3連単が読めない／3連単が表どうしで不一致／1着艇の記録が不一致／出走表の着順が不一致 | すべて |
| コース | 6 艇がそろわない／進入コースがそろわない／決まり手なし／決まり手と進入コースが矛盾 | イン逃げ・女子戦 |
| 払戻金 | 払戻金なし／表どうしで不一致 | 高配当 |
| 性別 | 6 艇がそろわない／マスタにない選手／性別コードとマスタが不一致 | 女子戦 |

集計全体の基準（満たさなければ `hold`、記事を作らない）：
- 集計できたレースが 100 件以上（`minSample`）。
- 集計できたレースが対象の 95% 以上（`minCoverage`）。
- 集計期間が前日（日本時間）までで終わっている。

集計結果には、期間・対象・母数・除外の内訳・カバー率・指標と、それらの SHA-256（`hash`）を残す。品質ゲートの時点でデータベースから集計し直し、`hash` が変わっていれば HOLD にする。

定義（今回の既定値。編集方針が決まれば変更する）：
- **イン逃げ**：1着艇の進入コースが 1 で、決まり手が「逃げ」。
- **女子戦**：出走 6 選手すべてが性別マスタで女性のレース。
- **5号艇1着**：3連単の 1 着が 5 号艇（号艇。進入コースではない）。
- **高配当**：3連単の払戻金が 10,000 円以上。

## 4. テーマ拡張

| キャラ | カテゴリー（既存 slug） | テーマ | 集計 |
|---|---|---|---|
| 一果 | `inside-course` | 〇〇のイン逃げ率を直近1年の確定結果で検証（24場） | `inside_escape`・365日 |
| 一果 | `beginner` | 初心者講座：全国のイン逃げ率を直近90日の確定結果で見る | `inside_escape`・90日 |
| 初音 | `women` | 女子戦のイン逃げ率と決まり手を直近90日の確定結果で検証（全国） | `women_inside_escape`・90日 |
| キイナ | `longshot` | 〇〇の5号艇1着率／3連単1万円以上の発生率（24場） | `boat5_win`・`high_payout`・365日 |

- 既存の 24 場テーマ（`stadium-charm`・`stadium-basics`・`stadiums`・`data-lab`・`characters`）は変更していない。
- 全国集計は API 経由の読み取り量が大きいため 90 日にしている（1 表あたり最大 150,000 行で止める）。期間を延ばすには、DB 側の集計関数（PHASE 2 以降、要承認）が必要。
- ローテーション用に `RESEARCH_ROTATION`（一果 → 初音 → キイナ）を定義した。日次の自動選定（PHASE 4）で使う。

## 5. 重複判定

| 信号 | 方法 | HOLD | 警告 |
|---|---|---|---|
| タイトル | 文字 2-gram の Dice 係数（既存） | 0.80 以上 | 0.60 以上 |
| 本文 | 文字 3-gram のコサイン類似度（出典欄などシステムのブロックは除く） | 0.86 以上 | 0.75 以上 |
| 同じ集計 | 集計の種類・対象の場が同じで、期間の重なりが 50% 以上（180 日以内の記事） | 該当 | — |

閾値はステージングの下書き（固定データ）で決めた：同じテーマの書き直し（戸田 v12/v13、桐生 v12/v13）は本文類似度 0.90〜0.92、同じ型で場が違う記事は 0.79〜0.82。0.86 で前者だけを止め、後者は「型の繰り返し」として警告する。**意味（埋め込み）による比較ではない**。必要なら後の PHASE で追加する。

## 6. 自動品質検証（7 ゲート）

| ゲート | HOLD（自動公開しない） | RETRY（作り直す） |
|---|---|---|
| データの整合性 | 出典にない数値・日付、出典の不一致、集計の再確認の失敗（変更・改ざん・基準未達）、研究記事に集計がない | — |
| 出典の検証 | 存在しない出典 ID、取得日時のない出典、再取得失敗のまま、比較用下書き、https でも内部でもない URL | 未登録の URL、出典欄がない |
| 既存記事との重複 | タイトル・本文・同じ集計の HOLD | — |
| 文章の有用性 | — | 採点表の平均 4 未満・2 点以下の項目（参考指標）、600 字未満、期間・母数の記載なし、注意点・限界の記載なし |
| SEO | noindex | タイトル 15〜60 字・説明文 50〜160 字の範囲外、抜粋・カテゴリー・著者・見出し・表紙がない |
| 著作権 | 外部・未登録の画像、動画の埋め込み | 取得した公式ページの文章を 40 字以上そのまま使用、出典のない引用 |
| 公開安全性 | メールアドレス・電話番号・秘密情報らしき文字列、選手の発言として引用した文 | 使用禁止の表現、的中・利益を誤解させる表現 |

- 全体の判定：HOLD が 1 つでもあれば HOLD。RETRY があれば RETRY（作り直しは最大 2 回。使い切ったら HOLD）。それ以外は PASS。
- 採点表の点数は補助指標で、PASS を RETRY にすることはあっても、事実確認の不合格を覆すことはない。
- 研究記事でない 24 場テーマも同じゲートを通る。取得日時のない収録データを使う記事は「出典の検証」で HOLD になるため、**自動公開の対象にならない**（人の承認で公開する）。

## 7. 自動公開の設計

### 7-1. 現在の `BLOG_AI_APPROVAL_REQUIRED`（調査）
`supabase/migrations/20261009180000_blog_ai_drafts.sql` の `blog_release` は、AI 下書き（`blog_ai_drafts` に行がある記事）について
1. `blog_ai_current_approval(p.id)` が null なら `BLOG_AI_APPROVAL_REQUIRED`、
2. 現在の版・本文 md5 に一致する承認が無ければ `BLOG_AI_CONTENT_CHANGED`
で公開・予約を拒否する。承認は `blog_ai_approve`（人の名前・ログインのハッシュ・版・本文）でだけ作られる。

### 7-2. 今回の方式
`blog_release` は**変更しない**。承認の種類を 1 つ足す：

- `blog_ai_settings`（1 行）：`approval_mode`（`manual` 既定／`auto`）、`auto_publish_enabled`（既定 false）、`generation_enabled`（既定 false）。`auto_publish_enabled=true` は `approval_mode='auto'` のときだけ許される（制約）。
- `blog_ai_gate_results`（追記専用）：ゲートの結果。**版・リビジョン・本文 md5 は DB が保存済みの記事から計算する**ので、呼び出し側が別の内容に PASS を付けられない。全体が PASS なら 7 ゲートすべて PASS であることを表の制約で強制。
- `blog_ai_system_approve`：自動モードかつ自動公開 ON、検査が PASS、同じ版・リビジョン・本文、その版の最新の検査結果、要修正 0・検証済みの版、をすべて満たすときだけ、`approver_kind='system'` の承認を記録する。
- `blog_ai_current_approval` を再定義：**システム承認は、自動モードかつ自動公開 ON の間だけ有効**。人の承認は今までどおり。
- 人の承認（`blog_ai_approve`）・管理画面からの承認と公開は削除していない（手動承認モード）。人が書いた記事は影響を受けない。

### 7-3. 緊急停止
- `blog_ai_settings.auto_publish_enabled=false` にした時点で、未公開のシステム承認はすべて無効（`blog_release` が `BLOG_AI_APPROVAL_REQUIRED` で拒否）。再デプロイ不要。
- 自動公開は予約を使わず、06:00 JST にその場で公開する手順にしている（`autoPublish.mjs`）。**注意**：人が管理画面でシステム承認済みの記事を予約した場合、予約公開ワーカー（`blog_publish_due`）は承認を再確認しない。停止時は予約も取り消す手順にする（PHASE 4 で、自動モードの記事を予約できないようにするか検討）。
- 承認が人とシステムの両方にある場合、公開記録の `ai_approval_id` には新しい方が入る（`blog_release` を変えないための制約）。

### 7-4. 自動公開の手順（`runAutoPublish`、まだどこからも呼ばれない）
1. 設定が自動モードかつ自動公開 ON でなければ何もしない。
2. 06:00 JST より前なら待つ。
3. 当日（JST）にシステム承認で公開した記事があれば終わる（1 日 1 本）。
4. 各記事の最新の検査結果が PASS かつ現在の版のものだけを候補にする。
5. `blog_ai_system_approve` → `blog_release`（即時）。DB が拒否したら公開しない。

日付単位の一意制約・ジョブ ID・リースによる二重実行防止は、状態管理表（PLANNED〜FAILED）とあわせて PHASE 4 で入れる。

## 8. Vercel Cron の停止の疑い（調査）

### 8-1. 事実（読み取りで確認）
Vercel Cron だけが書き込むデータの最終更新（UTC）：

| データ | Cron | 最終更新 |
|---|---|---|
| `trinity_prediction_snapshots` | trinity-shadow（2 分毎） | 2026-10-25 11:14 |
| `bs_news_candidates.verified_at` | news-verify | 2026-10-25 09:10 |
| `media_editorials.generated_at` | media-editorials | 2026-10-25 09:10 |
| `bs_racers.updated_at`・`bs_racer_sync_queue` | racer-master-sync（03:15・21:15） | 2026-10-25 03:16 |
| `bs_ichika_ai_analysis_metrics` | ichika-ai-analysis（21:35） | 2026-10-24 21:35 |
| `bs_data_lab_social_outputs` | data-lab-social（21:20） | 2026-10-24 21:20 |
| `bs_daily_result_digests` | daily-result-digest（14:10） | 2026-10-24 14:10 |
| `bs_character_ai_analysis_metrics` | hatsune-kiina-ai-analysis（21:45） | 2026-10-22 21:45 |

- 次に来るはずだった 2026-10-25 14:10（daily-result-digest）・21:15（racer-master-sync）などの書き込みがない。**2026-10-25 11:14〜14:10 UTC の間に、Vercel Cron 全体が止まったと考えられる**（hatsune-kiina は 10-22 から先に止まっており、別の原因の可能性）。
- 同じ期間、pg_cron の処理（前日結果の取得・hatsune ニュース・BLOG 予約公開・Discord 通知）は動いている。pg_net から Vercel の route を呼ぶと HTTP 200（直近 24 時間 437 件）→ **デプロイは動いていて、止まっているのは Vercel のスケジューラーからの起動**。
- その時間帯に main への `vercel.json` の変更・マージはない（`vercel.json` の最終変更は 2026-10-29 の Discord 5 件削除）。

### 8-2. 原因の候補（Vercel の画面で確認が必要。この環境からは見られない）
1. プロジェクト設定で Cron Jobs が無効にされた。
2. `CRON_SECRET` が変更・削除され、Cron の呼び出しが route で 401 になっている（Cron 自体は動いているが何も書かない）。各 route はスケジュールの呼び出しを `Authorization: Bearer ${CRON_SECRET}` で照合する。
3. プラン・利用上限（支出上限で関数の実行が止まる等）。ただし pg_net 経由の呼び出しは成功しているので、可能性は低い。

確認方法：Vercel → プロジェクト → Settings → Cron Jobs（有効か）、Logs で `/api/cron/trinity-shadow` を 10-25 以降で絞り、リクエストが無いのか 401 なのかを見る。

### 8-3. 影響
TRINITY の前日・当日シャドー、NEWS の検証・X 下書き・社説、日次まとめ、DATA LAB SNS、選手マスタ同期、一果・初音・キイナの AI 分析、展示オッズのスナップショット、中止情報の取得、X 夜間投稿候補が 10-25 以降止まっている可能性が高い。**今回はどれも変更していない**（既存 Cron・認証の変更は禁止のため）。

### 8-4. BLOG の自動実行方式の比較

| 観点 | Vercel Cron | pg_cron ＋ pg_net（Vault の秘密値で route を呼ぶ） | pg_cron だけ（DB 内で完結） |
|---|---|---|---|
| 現在の稼働 | 10-25 から停止の疑い | 稼働中（discord-alerts で実績） | 稼働中（blog-production-publish-due で実績） |
| 対象 | AI 生成（外部 API・画像生成が必要） | AI 生成・品質検査・自動公開 | 予約公開のみ（AI は呼べない） |
| 認証 | `CRON_SECRET`（共有） | 専用の秘密値（Vault）を route 側で照合 | 不要 |
| 実行履歴 | Vercel のログ（保持期間あり） | `cron.job_run_details`＋`net._http_response`＋`blog_ai_runs` | `cron.job_run_details` |
| 停止 | `vercel.json` の変更と再デプロイ | `cron.alter_job(active:=false)`、加えて `blog_ai_settings` | 同左 |
| 二重起動 | 重複スケジュールの恐れ | 同一ジョブ名で 1 件、route 側でリース | `FOR UPDATE SKIP LOCKED` |
| 注意点 | 原因不明の停止中 | Vault の秘密値の管理、pg_net の応答は非同期で失敗検知が遅れる | AI 処理には使えない |

**推奨**：AI 生成・品質検査・自動公開は「pg_cron ＋ pg_net ＋ BLOG 専用の秘密値（例 `BLOG_AI_CRON_SECRET`）」で route を呼び、予約公開は既存の DB 内 Cron のまま。Vercel Cron には登録しない（二重起動を避ける）。失敗検知は `blog_ai_runs` の記録と管理者向け Discord 通知で行う。登録は PHASE 4 で、作成時は inactive にする。

## 9. 環境変数（名前のみ。設定はしていない）

| 変数 | 用途 |
|---|---|
| `BLOG_RACE_DATA_SUPABASE_URL`・`BLOG_RACE_DATA_SUPABASE_KEY`（新規） | 研究テーマのレースデータ読み取り。未設定なら研究テーマは AI を呼ぶ前に 503 で止まる。`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` へのフォールバックはしない。読み取りだけに絞ったキーを推奨 |
| 既存 `BLOG_*`・`OPENAI_API_KEY`・`BLOG_AI_DRAFTS_ENABLED` | `docs/blog/AI-DRAFTS.md` のとおり |

## 10. 検証結果

- `node --test tests/blog/*.test.mjs`：**349 件中 337 合格・0 失敗・12 スキップ**（既存 291 合格を維持、追加 46 件合格。スキップは既存の HTTP 統合テスト）。
- `node --test tests/*.test.mjs`（リポジトリ全体）：473 件中 469 合格・4 失敗。**4 件は main でも同じく失敗**（member auth・racer sync・today レイアウト。今回の変更と無関係）。
- `node scripts/check-view-security.mjs supabase/migrations`：OK（ビューの追加なし）。
- `next build`：コンパイル成功。プリレンダーは既知の `/bsc2/admin/ai-dashboard`（Firebase 変数なし）で停止（main と同じ）。
- DB：PGlite（PostgreSQL 17）で既存 4 本＋新マイグレーションを適用し、初期 OFF、PASS 以外の拒否、内容変更・版の変更・後からの再検査の検出、緊急停止、手動承認の維持、追記専用、anon/authenticated の拒否、二重適用の拒否、`blog_release` が変わらないこと、戻し手順を確認。
- **ホストされた Supabase（ステージング）への適用・実際の AI 呼び出し・実データでの集計は未実施**（承認が必要）。

## 11. リスクと未対応

| 項目 | 内容 |
|---|---|
| マイグレーション履歴 | ステージングの AI マイグレーションは番号がリポジトリと違う（PHASE 0 で報告）。本番には BLOG 基盤の履歴自体がない。新しいマイグレーションの適用前に方針を決める |
| データ量 | 全国 365 日の集計は API 経由では読み取り量が多すぎる（150,000 行で停止）。DB 側の集計関数が必要（本番 DB の変更なので別承認） |
| プロンプト | 研究記事は既存プロンプト（場データ向けの説明を含む）で生成する。実際の出力品質はステージングで要確認 |
| 予約公開 | システム承認の記事を人が予約した場合、停止後も公開されうる（7-3） |
| 状態管理 | PLANNED〜FAILED の状態表・日付の一意制約・通知・管理画面のスイッチは PHASE 4〜6 |
| 意味的な重複 | 文字 n-gram による近似。埋め込みによる比較は未実装 |
| 自動公開の対象 | 取得日時のない収録データを使う 24 場テーマは自動公開されない（人の承認が必要） |

## 12. 戻し方

- コード：この PR をマージしなければ影響なし。マージ後は Vercel の直前のデプロイへ戻す。AI 機能は環境変数が未設定のため動かない。
- DB（適用した場合のみ）：まず `update public.blog_ai_settings set auto_publish_enabled=false, approval_mode='manual'`。必要なら `ops/blog/ai-quality-gates-rollback.sql`（システム承認があれば止まる。履歴は `blog_ai_gates_archive` へ移して残す）。
