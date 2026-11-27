# 開発① BRDB通常プラン非公開・単発試験の実行条件（2026-11-26 JST）

## 許諾と境界
Team-Naveは11/26 13:28 JSTに、照会した「単一クラウド実行環境、Q011準拠のRACEMST/RACEDTL少数取得、隔離環境保存、認証済み社内管理者のみの表示」について、検証／テストなら問題ないと回答。一般公開・有料会員・検索エンジンには出さない。定期取得、再配信、既存Windows再開、一般公開は禁止。

## 試験候補（実行前に対象日・場・Rを固定）
- 一度の対象は1日・1場・1R。 `buildBrdbSingleRaceQueries` でRACEMSTとRACEDTLの各1 SQLだけ。SOPDT >= 対象日10日前、OPDT = 対象日、RCOURSECDとRNOを等号指定。SELECTは開催・締切・6艇登録番号に必要な列のみ。
- BRDBは非同期POSTプロトコル（select、state、getcsv）。1 SQLが複数HTTP要求を要する。上限は選択1回（2 SQL）、状態照会最大3回、CSV取得最大2回、合計最大6 HTTP要求、再試行なし。選択応答・状態が不明、6艇欠損、CSV不正、締切不明なら即HOLD。自動スケジュールなし。
- 取得結果は隔離実行環境のメモリでのみ解析し、日付・場・R・艇番1～6登録番号を独立した公式出走表と照合。外部の公式ページ取得回数と対象は別途明示して承認を得る。今回の許諾はDB保存・管理者限定表示を可能とするが、本番Supabase・本番Vercelに実データを入れない。
- CSV本体、会員ID・パスワード、SQL本文、ダウンロードURL、Queue IDをActionsログ・artifact・PRへ出さない。ログはHTTP状態、件数、HOLD理由と取得時刻だけ。結果を保持するなら暗号化・アクセス制限・削除時刻を決めた専用隔離ストアを先に用意する。

## 現在の実行阻害
- このWork実行環境にはBRDB認証情報が設定されていない。GitHub connectorはActions Secretsの存在確認・登録と手動workflow_dispatchを提供しない。ローカルghも未認証。候補workflowは `.github/workflows/dev1-brdb-private-one-shot.yml`、secret名は `BRDB_TNC_ID` と `BRDB_TNC_PASSWORD`。専用GitHub Environment `dev1-brdb-private-trial` に置く想定。
- Draftブランチに新設したworkflow_dispatchは現時点で手動起動できると確認していない。GitHubでは通常、新規workflowは既定ブランチに存在する必要があり、候補を置いただけでは実行できない。既存PRのマージは禁止のまま。実行経路の設置は別の具体的承認と確認を要する。既存本番ワークフローや本番DBへ秘密を流さず、隔離クラウド実行環境とログ秘匿を確認する。
- 認証情報はチャット、PR、ソースに貼らない。所有者がGitHubのSettings → Environmentsで `dev1-brdb-private-trial` を作り、Environment secretsとして `BRDB_TNC_ID` と `BRDB_TNC_PASSWORD` を登録し、実行者制限と承認保護を確認する。値をこの会話へ送らない。Actionsの実行ログやCSV artifactも公開しない。
- 本番API負荷を伴う実行そのものは、対象日・場・R、HTTP上限、保存先と削除時刻、実行者を示した一回限りの承認を得てから行う。過去の最大3 GET承認は使わない。

状態: 手動候補クライアント／workflowと合成テストのみ。実行環境のsecret登録とworkflowの起動可能性は未確認。実API要求0、実データ保存0、公開0。
