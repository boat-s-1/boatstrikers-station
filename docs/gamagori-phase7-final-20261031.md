# 蒲郡チャート PHASE 7 最終統合検証

実施日: 2026-10-31（日本時間） / PR #294 / feature/gamagori-chart-collector

**判定: GO（マージの技術検証、および最大3Rの手動段階収集）。**

本番Cron有効化・mainマージ・本番デプロイは実施せず、ユーザー承認待ち。
前回のHOLD理由だった認証付きプレビュー実行、新規保存・再実行、同時実行防止、小規模バックフィルは実測で解消した。以前の監査報告のHOLD判定に対する追補である。

## 対象と変更

- 継承HEAD: 12fd3a5bdd8a46b266a7bb37e808377076e2169d。
- 統合検証済みコード: 52df63a47140b59f4c5ebd329311afee17c0a08e。
- 検証デプロイ: dpl_8Z7seShxFnEHfCxFzmKeNr9yxCwT（READY、Preview）。
- URL: https://boatstrikers-station-n68uivh10-boat-s-1s-projects.vercel.app
- route.js: 収集専用secret対応、DBリースで排他、競合時409。既存CRON_SECRET値は変更していない。
- gamagori-chart-collector.mjs: 公式アクセス試行数を返す。取得済みはupstream_attempts=0。リダイレクトは追わない。
- gamagori-chart-lease.mjs / database/gamagori-collector-lease.sql: グローバルリース。
- gamagori-chart-lease.test.mjs / gamagori-chart-transport.test.mjs: 排他、例外後解放、実HTTPの再試行・既定タイムアウト。
- scripts/gamagori-backfill.mjs: 専用認証/認証付き保護通過ヘッダー、--max-batches=1..4。
- scripts/gamagori-verify-saved.py: アプリとは別のHTMLParserで最大3Rを公式照合。
- docs/gamagori-phase7-* : HTTPレスポンス、DB値、ハッシュ、ランタイムログ、テスト結果。

TRINITY・ニュース・予想コード、vercel.json、既存Cronは未変更。

## 401の原因と解消

1. プロジェクトのSSO保護はenabled=true / all_except_custom_domains。前回のweb_fetch_vercel_urlは共有リンクの後のリダイレクトで保護認証に失敗していた。
2. その先のAPI自身もBearer認証を要求する。URLのみを受け取る取得ツールは任意Authorizationヘッダーを付けられない。既存CRON_SECRETはVercel sensitive変数で、単一変数取得でもdecrypted=falseで値が返らないことを確認した。
3. 既存secretを変更せず、作業ブランチのPreviewだけにGAMAGORI_COLLECTOR_SECRETをsensitive変数として追加。コードは専用secretがなければCRON_SECRETへフォールバックする。Production向け変数は追加していない。
4. Vercelの公式automation bypassを検証中だけ発行し、x-vercel-protection-bypassと専用Bearerを別々に送った。秘密値は端末エコーを無効化したメモリ内のクライアントで扱い、コード・証跡・ログに出力していない。
5. 保護を通過した旧APIへ誤Bearerを送るとJSON 401 unauthorized。新APIへ正しい認証を送るとJSON 200。これでSSO層とAPI層を分離して確認できた。
6. 終了時に今回作成したautomation bypassを再生成なしで失効。残存bypass 0件。失効した値での再アクセスは302のVercel認証リダイレクトとなり、API結果を取得できないことを確認。SSO設定は開始時と同じまま。Preview専用API認証変数はVercel sensitive管理に残す（値は提供しない）。

## 実プレビューでの検証

HTTP結果・所要時間・request IDはevidence JSONに収録。対応する関数ログも保存した。

|項目|実測|判定|
|---|---|---|
|2025-08-09 蒲郡1R|200 skipped_existing、公式取得0回、6艇不変|PASS|
|2025-08-09 2R 新規保存|200 saved、6艇追加、公式取得1回|PASS|
|2Rへ同時2リクエスト|片方200 saved、もう片方409 collector_busy。保存は合計6艇だけ|PASS|
|2Rを再実行|200 skipped_existing、公式取得0回、全値とcaptured_atも不変|PASS|
|2026-10-31 1R 未公開チャート|207 invalid_chart、取得1回、DB行0件|PASS|
|2025-08-09 3〜4R 段階バックフィル|200、各6艇追加、各公式取得1回|PASS|
|Bearerなし|保護通過後API自身がJSON 401 unauthorized|PASS|
|limit=4|400、収集しない|PASS|
|limit=3 / 1〜3R|3Rすべて既存スキップ、公式取得0回|PASS|
|実バックフィルCLIの1窓実行|--execute --max-batches=1、終了0、1〜3R既存スキップ|PASS|
|追加3Rの独立照合|公式を再取得し、別実装のPython HTMLParserで18艇の号艇・評価・矢印を照合。すべて一致|PASS|
|ランタイムログ|保存、スキップ、競合、invalid_chartの各request IDと応答を照合|PASS|

検証中のCollectorの公式アクセスは成功3回＋未公開1回。既存スキップ・競合では公式にアクセスしていない。別実装による照合は追加3回、1.5秒以上空けて逐次実行した。大量取得や無制限走査は行っていない。

## DBの前後比較

|項目|開始時|終了時|
|---|---:|---:|
|保存済みレース|192|195|
|保存艇数|1,152|1,170|
|今回追加|0|3R / 18艇|
|キー重複|0|0|
|保存済みレースの6艇欠損|0|0|
|矢印NULL（既存未記録）|1,020|1,020|

元の1,152艇はcaptured_at <= 2026-10-30T16:09:59.878031Zの集合として再照合した。行数と全行ハッシュが開始時と一致し、既存データを更新・削除していないことを確認。

- 元データの前後MD5: b168337fdc6b2dd7b6e9b0eeeaac33d1
- 追加後の全1,170艇MD5: 538760bc13bd7e7e11f6d08ec5be7dbe
- 指定1Rの全6艇: 開始時のJSONと完全一致。
- 新規2Rの全6艇: 初回保存直後と再実行後のJSONが完全一致。
- 未公開チャートの対象キー: 0行。

これは保存済みレース内の6艇完全性であり、全開催レースを網羅したという意味ではない。既存NULL矢印をnoneへ変換していない。

## 排他・再試行・タイムアウト

**新しい収集専用DBオブジェクトを対象プロジェクトに追加済み。** 既存チャートテーブルのスキーマ・既存行は変更していない。

- migration: 20261030164104 / gamagori_collector_global_lease。
- 新テーブル: public.bsc_gamagori_collector_lease。RLS有効、anon/authenticatedのテーブル権限なし。
- acquire/releaseの2関数はSECURITY INVOKER。PUBLIC/anon/authenticatedのEXECUTE権限なし、service_roleだけに付与。
- 全日付・全R・全インスタンスで共通の1リース。期限120秒、API maxDuration=60秒。競合は処理開始前に409とRetry-After:120を返す。
- finallyで所有者一致時だけ解放。解放後も1.5秒のクールダウンを残す。クラッシュ時は期限経過で回復する。
- 実プレビュー同時リクエストに加え、service_roleのSQLトランザクション内で、二重取得拒否、別所有者の解放拒否、正常解放、クールダウン、期限を過去へ動かした回復、旧所有者による新リース解放の拒否をassertし、ROLLBACKした。
- ローカルの実HTTPサーバーで503→200を発生させ、再試行1回で実fixtureの6艇が解析・INSERT処理へ到達することを検証。1.5秒設定の間隔は実HTTPで1450ms以上を許容下限としてassertした（時計・サーバー受信の差の許容）。
- 無応答の実HTTPサーバーで既定8秒timeoutを2回発生させた。約16.006秒で失敗となり、INSERT呼び出しは0。ネットワーク待ちとAbortSignalをモックしていない。DB部分はモックである。
- 既存11テストを保持し、合計15 PASS / 0 FAIL。

Security Advisorでは新リース表のrls_enabled_no_policyがINFOとして検出された。service_role専用のため意図した構成で、一般ロールへの許可policyは作成しない。権限の否認を別途確認済み。[Advisor説明](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)

## 未実施・未観測（PASSとしない）

|項目|状態・理由|
|---|---|
|Vercel上での公式上流5xx/timeoutの故障注入|未実施。公式サイトは検証中に正常応答した。故障を誘発せず、同じcollectorをローカル実HTTP障害で検証した|
|Vercelプロセスの60秒強制終了と120秒自然経過|未実施。処理を意図的に停止させていない。DBの期限回復・所有者判定はROLLBACKするSQLで検証した|
|既存192Rの全公式ページ再取得|未実施。前回2件と今回追加3件が照合範囲。大量アクセスを避けた|
|常時運用の長期安定性・全期間バックフィル|未実施。今回の実バックフィルは2025-08-09の2〜4Rのみ|
|mainマージ・本番デプロイ・本番Cron|ユーザー承認待ち。実施していない|

## 運用時の注意と次の承認対象

マージ技術判定はGO。実動作の証跡があるのは上記Previewと最大3Rの手動収集である。本番Cronの稼働実績を意味しない。

承認後も本番導入は手動1窓のスモークテストから始め、ログと保存件数を確認してから定期化する。Cronの追加・有効化は別途承認対象。429/403や不完全チャートは停止し、失敗窓から再開する。既存レースの評価訂正を追記する版管理や、過去NULL矢印の復元は今回の範囲外。

復旧時は収集呼び出しを止めれば他システムへ影響しない。リース表・関数は収集専用であり、既存チャート行を消さずに残せる。ロールバックDDLは今回実行していない。

## 証跡の読み方

- gamagori-phase7-evidence-20261031.json: HTTP応答・request ID・前後比較・独立照合の全値とHTML SHA-256。
- gamagori-phase7-runtime-20261031.txt: Vercel関数ログ。日時はUTC表記。
- gamagori-phase7-tests-20261031.txt: 15テストの実行記録。
- gamagori-phase7-saved-samples.json: 今回追加した18艇の全値。
- scripts/gamagori-verify-saved.py: 読み取り専用の独立照合手順（最大3R）。

秘密鍵・Bearer・bypass値は収録していない。
