# 管理API 認証不足の調査（読み取りのみ）

調査日：2026-10-08。対象：`app/api/admin/**`、`app/api/ai/**`、`app/api/ai-v2/**`、`app/api/bsc2/**` の `route.js`。
方法：ソースの読み取りのみ。DBの更新・削除・RPC実行、APIの呼び出しは行っていない。新聞関連（PHASE 1 で修正済み）は対象外。

判定：ハンドラの先頭で認証（管理Cookie、各画面専用のCookie、`x-bsc-ai-key`、`CRON_SECRET` など）を確認していないものを「認証なし」とした。`middleware.js` は存在しないため、`/admin` 画面のレイアウト認証はAPIには効かない。

## 結果（リスクの高い順）

| # | リスク | メソッド・パス | 認証 | できてしまうこと | 呼び出し元 |
|---|---|---|---|---|---|
| 1 | 高 | `POST /api/admin/exhibition-backfill` | なし | 外部サイトから展示データを取得し、`bs_race_entries` の公式展示列（`official_exhibition_*`, `official_lap` など）を **UPDATE**。`date`・`cursor`・`batchSize` を任意指定可。予想・アラート・公開ページの元データに直結 | `/admin/exhibition-data-status` の BackfillButton |
| 2 | 高 | `POST /api/admin/engine-v3/refresh` | なし | RPC `bs_engine_v3_refresh_all` / `bs_engine_v3_refresh_stadium` を任意の `asOf` で実行（重い再集計・データ更新） | `/admin/engine-v3` |
| 3 | 高 | `POST /api/admin/stadium-ai-v2/refresh` | なし | RPC `bs_refresh_all_stadium_ai_v2` / `bs_refresh_stadium_ai_v2` を任意の `asOf`・場で実行 | `/admin/stadium-ai-v2` |
| 4 | 中〜高 | `POST /api/admin/exhibition-alerts` | なし | RPC `evaluate_boat4_double_top_alerts`（アラート行を追加。通知Cronの対象になりうる） | `/admin/exhibition-alerts` |
| 5 | 中〜高 | `POST /api/admin/ichika-hidden-escape` | なし | RPC `evaluate_ichika_hidden_escape_alerts`（同上） | `/admin/ichika-hidden-escape` |
| 6 | 中〜高 | `POST /api/admin/hatsune-womens-inner-break` | なし | RPC `evaluate_hatsune_womens_inner_break_alerts`（同上） | `/admin/hatsune-womens-inner-break` |
| 7 | 中 | `GET /api/ai-v2/settle-bets` | なし | `bs_ai_bet_results` を **UPSERT**（AI買い目の精算）。GETで誰でも実行できる | アプリ内の呼び出しなし（外部の定期実行の可能性。要確認） |
| 8 | 中 | `GET /api/admin/exhibition-alerts`・`/ichika-hidden-escape`・`/hatsune-womens-inner-break` | なし | 理論アラート（会員向け機能の判定結果・成績）を Service Role で読み出し | 各管理画面 |
| 9 | 中 | `GET /api/admin/data-lab-social-image` | なし | 未公開のSNS用素材 `bs_data_lab_social_outputs.image_payload` の読み出し | `/admin/data-lab-social` |
| 10 | 低〜中 | `GET /api/admin/grade-races`、`GET /api/admin/engine-v3/refresh` | なし | ランキング・集計状態の読み出し（Service Role） | 各管理画面 |
| 11 | 低〜中 | `GET /api/admin/official-exhibition-probe`、`historical-exhibition-check`、`verified-exhibition-check`、`exhibition-source-diagnostic`、`tsu-source-diagnostic`、`tsu-original-tenji-test`、`{amagasaki,miyajima,toda,tsu}-original-html-diagnostic` | なし | 公式サイト等への取得を誰でも起動できる（外部サイトへの負荷・踏み台）。DB書き込みはなし（`.delete` はメモリ上のキャッシュ）。一部は1秒1回の制限あり | 診断用 |

## 認証ありを確認したもの（参考）

- 管理Cookie（`isAdminAuthenticated`）：`newspapers/*`、`*-news/*`、`note-features`、`sync/*`、`hatsune-news/video*`
- 画面別の認証：`requireRadioBlogAdmin`（radio-blog・magazine・seminar-magazines・ichika-books・stadium-ai）、`isScheduleAdminAuthenticated`（schedule・realtime・ticker・results）、`isMembersAdminAuthenticated`（discord-members）、`requireAdmin`（discord-character-replies）、`requireBlogAdmin`（blog/*）、`requireMemberEntitlementFromRequest(admin)`（feature-usage）
- キー認証：`assertAiAdminRequest` / `assertAiAdmin` / `assertAdmin`（`x-bsc-ai-key`。`ai/generate-predictions`、`bsc2/*`）、`CRON_SECRET`（`hatsune-news/generate-ai`）
- 公開前提：`GET /api/ai-v2/character-panel`（公開統計RPC `ai_v2_public_character_stats`。公開画面から利用）

## 修正の方針（未実施・承認待ち）

1. #1〜#6・#8〜#10：呼び出し元はすべて `/admin` 配下の画面（管理Cookieでログイン済み）なので、PHASE 1 と同じく `isAdminAuthenticated` を先頭で確認して 401 を返す。画面側は 401 時に再ログインを案内する。
2. #7：呼び出し元（外部の定期実行の有無）を本番の `cron.job` 等で確認してから、`CRON_SECRET` による認証を追加する。
3. #11：管理Cookie必須にするか、不要になった診断APIを削除する。
4. いずれも、変更前後の比較テスト（未認証は401・DBに触れない／認証時は応答が変わらない）を PHASE 1 と同じ方法で追加する。
