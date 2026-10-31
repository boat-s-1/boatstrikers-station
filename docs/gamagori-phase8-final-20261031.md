# 蒲郡チャート PHASE 8 本番導入前準備

2026-10-31 日本時間 / PR #294

**最終判定: HOLD。** 実装・データ保全・後段の順次収集・監視は検証できたが、Vercelから公式開催一覧を取得する経路が8秒タイムアウトとなった。常時自動運用の前提なので未解決のままGOにしない。

PHASE 7のGO・15 PASS・195R/1,170艇を継承。本番Cron登録/有効化、mainへのマージ、本番デプロイは実施していない。vercel.jsonも変更していない。

## 実装とコミット

- c670b726a94a614731518abfe695976cb9e7c681: オーケストレーター、永続タスク/実行履歴、監視API、解析/認証強化とテスト。
- 52e2dce9cc1ff8bb3148c79267e5823760bdc804: 開催一覧のHTTP/ネットワーク/タイムアウトを固定エラーコードに分類。開催不明/出走データ不足は503で返す。
- 検証Preview: dpl_DM5HrNa4KXygAZWWFjcbLi39tDNn（READY）。URLはevidence JSON参照。
- 本番ではGAMAGORI_ORCHESTRATOR_ENABLEDがtrueでなければ処理しない。今回trueを設定したのは作業ブランチのPreviewのみ。Production向け設定は追加していない。

主な変更ファイル:

|範囲|ファイル|
|---|---|
|順次収集|lib/gamagori-chart-orchestrator.mjs / .test.mjs|
|Cron入口（未登録）|app/api/cron/gamagori-chart-orchestrate/route.js|
|監視|app/api/admin/gamagori-chart-monitor/route.js|
|共通認証・DB timeout|lib/gamagori-chart-http.mjs / .test.mjs|
|既存収集の共通期限/リース所有者|gamagori-chart-collector.mjs / gamagori-chart-lease.mjs|
|HTML解析の強化|gamagori-chart-parser.ts / .test.mjs|
|専用DB状態・RPC|database/gamagori-orchestrator.sql|
|公式開催一覧fixture|tests/fixtures/gamagori/calendar-*.html|

TRINITY・ニュース・予想システムのコードは変更していない。

## 開催判定と順次収集

1. 日付指定がなければJSTの当日を自動選択。認証済みの過去日指定は小規模バックフィル用。未来日を収集入口へ指定すると400。
2. PHASE 7の全インスタンス共通リースを取得。競合は409。リース120秒 > Functionの明示的なmaxDuration 60秒。
3. 専用RPCでタスク・実行履歴を準備し、保存済み6艇から進捗を再構築。部分既存はblockedとして取得しない。
4. BOAT RACE公式の開催一覧を照合する。正常な一覧の07開催リンクがあればheld、一覧が正常で07がなければno_meeting。ページ取得失敗/形式変更/空一覧はunknown。DBのレース枠だけで開催を確定しない。
5. 成功した開催判定は6時間キャッシュ。判定不能は30分空ける。非開催時は蒲郡チャートへアクセスしない。開催なのにDBイベントがない場合も別のevent_data_missingとして停止する。
6. 当日は締切6分前から対象化。締切不明は自動取得せず監視に表示。過去日は締切時刻が欠けていても対象にできる。取消等のフラグがあるRは除外する。
7. 次回試行時刻が来た未保存Rを、未試行・古い試行から順に最大3R選ぶ。未公開の1Rだけが後続を塞がない。
8. DBで取得権を予約してから既存collectorを呼ぶ。1R最大6回、各回の5xx/ネットワーク再試行は最大1回。未公開/失敗は次回2分後以降。403/429は当該日の処理を30分止める。
9. 終了時に各Rとrunをチェックポイント化。保存直後に停止しても、次回は6艇の実データを見てcompleteへ復元する。runningが120秒以上古ければ中断から回復する。6回消費したRはexhaustedとして手動確認し、無限再試行しない。

当日をまたいだ未完了分は過去日指定で再開する。無制限に過去開催日を走査する処理は追加していない。

## 実行結果と未検証の区別

|確認項目|実行結果|判定|
|---|---|---|
|関連テスト|蒲郡26 + 一果/Discord/TRINITYの既存回帰24、計50 PASS / 0 FAIL|PASS|
|JST境界・公式一覧解析|当日/過去の実HTML由来fixtureで開催/非開催、壊れたHTMLの判定拒否|PASS|
|Vercelでの公式一覧取得|初期6秒、診断版8秒とも取得できず。診断版は503/calendar_timeout、保存0|FAIL・HOLD理由|
|不明時の安全停止|開催を推測せずチャートにアクセスしない|PASS|
|非開催日の実API|検証済みの公式キャッシュを手動投入した2026-10-26でnon_meeting、取得0|PASS（キャッシュ使用）|
|取得前の当日実API|同じく検証済みキャッシュで締切前の未来Rを選ばずwaiting_or_complete|PASS（キャッシュ使用）|
|保存済み日の実API|2026-10-27は12R completeを再構築し取得0|PASS（キャッシュ使用）|
|新オーケストレーターの保存|2026-10-30の未保存3Rだけを選び6艇追加|PASS（キャッシュ使用）|
|直後の再実行|waiting_or_complete、追加0/公式取得0|PASS|
|監視API|認証あり200、認証なし401。10/30は12R完了、欠損0、最終取得日時を表示|PASS|
|中断回復・取得権・6回上限|本番DBの専用テーブル/RPCをservice_roleでassertしROLLBACK。チャートへの書込なし|PASS|
|未公開からの再試行・待ち時間・公平性|注入したcollector結果と時刻によるローカルテスト|PASS（新入口での未公開HTTP実測ではない）|
|8秒timeout/再試行|実HTTPを使う既存collector試験を再実行。無応答2回でINSERT 0|PASS（ローカル実HTTP）|
|実Vercel強制終了/長期常時運用|停止を誘発していない。定期稼働も未有効化|未実施|

後段の動作を切り分けるため、別環境で実際の公式一覧を読み取って検証した4日分だけを、専用の開催キャッシュへ手動登録した。この手動キャッシュは「Vercelから自動取得できた」という証拠には数えていない。evidence JSONに各公式ページのURL/SHA-256と実API応答を収録。

作業中に10/31を非開催と読み違えたが、ページ全体を解析するテストでheldと確認し訂正した。誤った判定値は実行キャッシュへ登録していない。

## データ整合性

|項目|PHASE 8開始|終了|
|---|---:|---:|
|保存レース|195|196|
|保存艇数|1,170|1,176|
|今回追加|0|1R / 6艇|
|キー重複|0|0|
|保存済みR内の6艇欠損|0|0|

元1,170艇はcaptured_at <= 2026-10-30T16:45:43.242921Zで再照合。行数と全行MD5が一致し、評価・矢印・保存時刻を含む既存値は不変。

- 元1,170艇MD5: 538760bc13bd7e7e11f6d08ec5be7dbe
- 追加後全1,176艇MD5: 90007bfa6db5c1ff495b2bfce5b6df4b
- 新規2026-10-30 3Rの6艇は、別実装Python HTMLParserで公式HTMLと全値一致。
- 最終取得: 2026-10-31 02:37:47 JST（17:37:47 UTCの翌日）。

保存済みR内の欠損0と、全開催レースの収集漏れ0は別である。後者の全期間監査は今回実施していない。

## 監視とセキュリティ

認証付きGET /api/admin/gamagori-chart-monitor?date=YYYY-MM-DD を追加した。公開APIではなく、CRON_SECRETまたはPreview専用認証が必要。応答はprivate/no-store。

- global_saved_races / global_saved_boats: 保存済み全体数。
- expected_races: 公式開催が確認できた場合の対象R数。非開催は0、未判定はnull。
- complete_races: 保存済み6艇のR数。
- missing_due_races: 締切済みで保存0のR数。非開催は0、未判定はnull。未来Rを欠損と混同しない。
- partial_races / flagged_races / unknown_deadline_races: 6艇不完全、取消等フラグ、締切不明を区別。
- last_captured_at / last_captured_at_global: 対象日/全体の最終保存日時。
- tasks: attempts、upstream_attempts、next_attempt_at、last_reason、exhausted等。
- recent_runs / stale_running_runs: 直近5実行と中断検知。runのcompletedは処理終了であり収集成功を意味しない。outcomeと実データ件数を確認する。

専用days/tasks/runsの3テーブルを追加。RLS有効、anon/authenticatedのテーブル権限なし。3RPCはSECURITY INVOKERでservice_roleのみEXECUTE可能。既存チャート表や既存アプリのスキーマは変更していない。

適用migration:

- 20261030172615 gamagori_collection_orchestrator_state
- 20261030172904 gamagori_monitor_historical_due
- 20261030174052 gamagori_monitor_flagged_races

HTML解析は画像srcだけを採用し、テキスト/コメント中のファイル名を艇と数えない。画像とaltの号艇が矛盾すれば拒否する。日付は妥当性検証し、取得先は固定公式URL。秘密値・生例外をログへ出さない。新機能の情報レベルのRLSポリシーなし通知は、service_role専用の意図した構成である。[Advisor説明](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)

今回の一時automation bypassは失効し、失効後の再アクセスが302でVercel認証へ戻ることを確認した。SSOのenabled=true/all_except_custom_domainsは維持している。

## Vercel頻度・時間・公式負荷の設計

未登録の候補: UTC `*/2 22-23,0-13 * * *` = JST 07:00〜22:59の2分間隔。最大480起動/日。実際のチャート取得は開催判定・締切・既存データ・再試行待ちで絞る。

- Functionは明示的に60秒。オーケストレーターの共有処理予算38秒をcollectorにも渡す。個々のRへ50秒ずつ別予算を与えない。残り15秒未満では次Rを予約しない。DB各リクエスト2.5秒、開催一覧8秒、チャート8秒、リース解放とチェックポイントの余白を確保。
- 各起動最大3R、各RのHTTP最大2回なのでチャート最大6アクセス/起動。
- 1日12R・各R最大6予約・各予約最大2HTTPとして、自動収集の上限は対象日あたり144チャート要求。正常なら12要求/開催日。チャート間は1.5秒以上空け、全インスタンスで共通リースを使う。
- 正常な開催キャッシュは6時間なので16時間の稼働窓で概ね3回の全国開催一覧要求。判定失敗時は30分キャッシュで最大32回/稼働窓。取得不能時に蒲郡チャートへ進まない。
- Vercel Cronは[公式制限](https://vercel.com/docs/cron-jobs/usage-and-pricing)でHobbyが1日1回、Pro等は毎分まで。2分案はPro以上が前提。利用中チームの契約プランは利用可能なツール応答に含まれず未確認。適用前に確認が必要。
- [maxDuration](https://vercel.com/docs/functions/configuring-functions/duration)のプラットフォーム既定値とは別に、本機能は60秒へ制限している。480×60秒は仮の最悪壁時計上限で、CPU実使用量や料金の見積額ではない。実稼働課金は未測定。

## 本番導入後の段階的バックフィル計画（未実行）

まずHOLD条件の公式開催一覧取得を解消し、契約頻度を確認したうえで、別途本番導入の承認を得る。

1. 本番手動スモーク: 既存2025-08-09 1Rでスキップを確認。Cronはまだ有効にしない。
2. 試行段階: 過去日指定のオーケストレーターを1回だけ呼ぶ。最大3R追加。日付、開始件数、結果、保存件数、重複/部分R、元データハッシュ、公式との突合を記録。
3. 連続3日: 1開催日/日まで、1回3R、呼び出し間隔10分以上。エラー時はその日の拡大を止め、checkpointから再開。未公開/404/形式不明を取得成功にしない。
4. 安定後: 手動予算を最大36R/日に制限し、当日自動収集を優先する。同じグローバルリースで競合を拒否。過去日ごとの自動上限と、運用者による全バックフィル日次予算は別である。
5. exhausted/blocked/判定不能は一覧化して個別監査。既存行の矢印NULLや評価訂正を自動上書きしない。公式の保存期限・全期間の可用性は未確認。

今回の本実行は検証用の2026-10-30 3Rだけ。上記の大量バックフィルは行っていない。

## ロールバック手順（未実行）

1. 新機能だけのGAMAGORI_ORCHESTRATOR_ENABLEDをfalseにし、承認後に有効化した場合の新Cronパスだけを停止する。他の既存Cronには触れない。
2. 実行中Functionの60秒とリース120秒が解消されるのを待ち、監視のstale_running_runsと実行ログを確認する。
3. 必要なら直前の承認済みデプロイへ戻す。mainやProductionへの操作はこの手順書作成では実施していない。
4. チャート行は削除・上書きしない。追加したdays/tasks/runsと既存リースは残してよい。再開時に保存済み6艇から進捗を復元できる。
5. 不審な保存値が見つかっても自動削除せず、対象キーと証跡を固定して別途監査する。DROP/DMLのロールバックは今回実行していない。

## HOLD解除条件と残る未検証

- Vercel実環境から公式開催一覧の取得が成功すること。現在はHTTP応答を得る前の8秒タイムアウトで、DNS/TCP/TLS/先方応答遅延のどこかまでは特定できない。403やアクセス制限を観測したわけではない。検証済みキャッシュを手で入れれば動くことは解消条件にならない。
- キャッシュが空/失効した状態で、当日開催・非開催の両方を実環境で自動判定すること。
- Vercelの契約プランに候補頻度が適合すること。本番Cron、長期稼働、実際の強制終了からの回復は未実施。

上記をPASSへ変更していない。本番Cron有効化・mainマージ・本番デプロイは承認待ちのまま。
