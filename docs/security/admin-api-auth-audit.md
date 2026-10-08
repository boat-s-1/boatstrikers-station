# 管理API 認証不足の調査と修正状況

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

## 修正状況（PHASE 2.5、ローカルのみ・未デプロイ）

#1〜#8 の7本は修正済み。各ハンドラの先頭で `app/api/_lib/adminGuard.js` の `rejectUnlessAdminOrInternal` を呼び、次のどれかが無ければ 401 `{ ok: false, error: "unauthorized" }` を返す（DB接続・外部取得・RPCの前に止まる）。

- 管理者Cookie（`bs_admin_sync`。`/admin` 画面と同じ）
- `Authorization: Bearer <CRON_SECRET>`（既存のVercel Cronと同じ）
- `x-supabase-cron-token`（既存のCronルートと同じSHA-256照合。`lib/security/requestAuth.mjs`）

| API | 呼び出し元（コード上） | Cron・内部サービスからの利用 | 適用した認証 |
|---|---|---|---|
| `POST exhibition-backfill` | `/admin/exhibition-data-status`（BackfillButton） | リポジトリ内に無し | 管理者Cookie または Cron認証 |
| `GET/POST engine-v3/refresh` | `/admin/engine-v3` | 週次の再集計は Supabase の pg_cron がDB関数を直接実行（APIは経由しない） | 同上 |
| `POST stadium-ai-v2/refresh` | `/admin/stadium-ai-v2` | リポジトリ内に無し | 同上 |
| `GET/POST exhibition-alerts` | `/admin/exhibition-alerts` | 通知は `/api/cron/exhibition-alerts`（別ルート、認証あり）がRPCを直接実行 | 同上 |
| `GET/POST ichika-hidden-escape` | `/admin/ichika-hidden-escape` | 同上（`/api/cron/ichika-hidden-escape`） | 同上 |
| `GET/POST hatsune-womens-inner-break` | `/admin/hatsune-womens-inner-break` | 同上（`/api/cron/hatsune-womens-inner-break`） | 同上 |
| `GET settle-bets`（＋新設 `POST`） | アプリ内に無し | **不明**。`vercel.json`・マイグレーション・Actions に無い。Supabase の pg_cron や外部サービスから呼ばれている可能性がある | 同上 |

### settle-bets（GETでDBを更新するAPI）の扱い

- 認証なしのGETは 401（副作用なし）。認証付きのGETは従来どおり精算を行う（Vercel Cron はGETしか送れないため、既存・将来の定期実行との互換を残した）。
- 明示的に実行するための認証付き `POST` を追加（処理はGETと同じ）。
- 完全な分離（GETは集計の参照だけ、精算はPOSTのみ）は、呼び出し元を本番で確認してから行う。手順：
  1. 本番の `select jobid, jobname, schedule, command from cron.job;` と Vercel のアクセスログで `/api/ai-v2/settle-bets` の呼び出し元を確認する。
  2. 呼び出し元が Supabase pg_cron なら `net.http_post` に変え、`x-supabase-cron-token` を付ける。Vercel Cron なら `CRON_SECRET` 付きGETのまま。
  3. 呼び出し元を切り替えた後で、GETを読み取り専用にする。
- **注意**：呼び出し元が認証情報を送っていない場合、デプロイ後に精算が止まる（401）。デプロイ前に上記1の確認が必要。

## 未修正（次の候補）

1. #9〜#10（未公開素材・集計の読み取り）：呼び出し元はすべて `/admin` 配下の画面なので、同じ `rejectUnlessAdminOrInternal` を適用できる。
2. #11（診断API）：管理Cookie必須にするか、不要になったものを削除する。
3. いずれも、変更前後の比較テスト（未認証は401・DBに触れない／認証時は応答が変わらない）を同じ方法で追加する。
