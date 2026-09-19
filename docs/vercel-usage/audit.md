# BoatStrikers Vercel使用量監査 — 2026-09-14

## 結論・適用状況

基準: main `469e71ff93ce5abeb04394ea6978277487f87b47`。122 Route Handler、144 fetch呼び出し、286 dynamic化候補、128タイマー/イベント/router候補、548 JS/TSファイルを静的解析（構文エラー0）。全件は [inventory.md](inventory.md)、再検査用データは [source-inventory.json](source-inventory.json)。文字列候補には非ネットワークの時計更新、Nextとは無関係のheaders関数も含むため、件数を無駄なFunction数とは扱わない。

sessionの重複抑制は別の[PR #85](https://github.com/boat-s-1/boatstrikers-station/pull/85)で実装済みだが未マージ。本監査では、公開データの短期キャッシュ、閲覧していないタブの取得停止、管理用Cronの減速、AI保存エラー修正用migrationを小さく追加した。本番アプリへの反映・DB migrationの適用はまだ行っていない。通知、LINE配信、会員権限の認可は変更していない。

## 実測と推定の区別

Vercel production runtime logsの24時間集計（2026-09-14 10:58 UTC付近）では、session 670、discord-alerts 449、exhibition-alerts 420、exhibition-alert-lines 420、community-setup 288、generate-predictions 288、hidden/inner/surge各280、race-threads 192、odds 90。これはログ集計であり、課金対象Invocationの確定値でもPOST限定件数でもない。上位件数に表示されないAPIを0とは扱わない。

同日06:14 UTCのsessionは1,324、ユーザー提示値は約2,254/24h。窓とデプロイが異なり、未デプロイの今回の修正効果とは判定できない。ユーザー数、タブ数、滞在時間が取得できていないので、日次200〜400という目標値は根拠不足で採用しない。

## 原因・改善 TOP10

| 順位・優先度 | 該当ファイル／問題コード | なぜ増えるか | 修正・安全性・リスク | 現在→修正後→削減率 |
|---|---|---|---|---|
| 1 最優先 | `app/components/MemberSessionBridge.js`, `app/lib/memberSessionSync.js`, `app/library/components/MagazineSwipeViewer.js`: authイベント、初期化、独立POST | 初期セッション取得とイベント、雑誌独自同期が競合。同一ユーザーだけの40分抑制は更新トークンを区別しない | PR85: 同一トークンのsingle-flight、POST/DELETE直列化、ログアウト時の無効化。トークン変更は必ず同期。別タブ・Cookie期限・障害復旧は監視 | 同一トークン40並列→1 POST、合成条件で97.5%減。日次2,254→未算出。実測の原因割合不明 |
| 2 最優先 | `supabase/migrations/20260913_freeze_published_bets.sql`: `investment` / `ticket_count * 100`をINSERT。`app/api/ai/generate-predictions/route.js`→`app/lib/aiPredictionPersistence.js`→DB trigger | GENERATED ALWAYS列へのINSERTが保存全体を失敗させ、次の5分起動でも同じ障害 | 新migrationでその列・値だけを除去。買い目固定条件を保持。一時テーブル回帰テスト成功。本番適用前。予想を再生成すると既存障害の影響が表面化する可能性 | 約288起動/日→288（起動削減0%）。失敗約245/日→同原因0を目標。失敗除去率は期待値100%、総コスト削減率は不明 |
| 3 高 | `vercel.json`, `app/api/cron/discord-community-setup/route.js`: `*/5 * * * *` | 常設カテゴリ/チャンネル構築を5分ごと。24h全288件500、上流Discord 403 Missing Access code50001を確認 | 毎時17分に減速。会員同期・通知Cronと分離済み。構造自動修復が最大1時間遅れる。Discord権限修復は別途必要 | 設定上288→24/日、91.7%減（264/日）。変更後の実測ではない |
| 4 高 | `app/bsc2/admin/page.js`, `app/bsc2/admin/ai-factory/page.js`, `app/admin/sync/SyncDashboardClient.js`: 5秒/15秒setInterval | 背景タブでも2/3/1 API取得。前の取得完了前の次回開始。selectedJobId変更でもeffect再開始 | 共通visiblePollingで非表示停止、実行中抑制、復帰時の期限チェック。選択IDは関数型setStateに変更。手動操作とは共有ロックせず、別タブも別制御 | 表示中1時間で1,440/2,160/240回。8時間開いて2時間表示の推定例:11,520→2,880、17,280→4,320、1,920→480、各75%減（初回等除く） |
| 5 高 | `app/api/cron/exhibition-alerts/route.js`, `exhibition-alert-lines/route.js`, hidden/inner/surge cron、DB cron | 配信・検出が複数schedulerに分散。DB評価420回とLINE経由の評価420回が重複する余地 | 今回は配信停止なし。検出結果共有と配信claimの原子的更新を次段階で設計。送信後に通知済み更新する方式では並行送信に注意 | 関連HTTP420+420+280×3=1,680/日→今回1,680、0%。同一評価を統合できればDB評価840→420の推定50%減。HTTPとDBを混同しない |
| 6 中 | `app/races/components/ExhibitionAutoRefresh.js`の`router.refresh()`、`getRaceDetail` | 表示中15秒ごとにRSC全体を再実行し、複数DB問い合わせと認証を再実行 | 現状すでに背景・過去レース・締切後の停止あり。必要な差分だけ取得する設計を次段階に回す。個人情報付きページを公開キャッシュしない | 活動中240 refresh/時/タブ→今回240、0%。滞在・更新対象不明につき将来削減率未算出 |
| 7 中 | `app/comic/page.js`, `app/ichika-sensei/page.js`: force-dynamic/revalidate=0、RSS parseURL | 公開一覧なのに毎訪問RSS取得とサーバー描画 | revalidate=300のISR、RSS timeout10秒。個人情報なし。新着反映最大約5分、RSS障害時の空一覧も次回再生成まで残り得る | 推定例:同じ5分内100閲覧→約1再生成、約99%減。地域・cold start・閲覧間隔に依存、実トラフィック次第で0%もあり |
| 8 中 | `app/api/home/realtime/route.js`, `app/components/HomeCompactRealtime.js`: public GETなのにno-store取得 | 同じ公開レコードを各閲覧でFunctionから取得 | 正常結果のみs-maxage=30、ブラウザmax-age=0。未設定/障害fallbackはno-store。30秒の更新遅延、CDN実ヒットをデプロイ後確認 | 推定例:同じキャッシュキー30秒内20取得→約1 origin、95%減。実日次件数不明 |
| 9 中 | `app/library/stadium/[place]/TodayRacePremium.js`, `StadiumPremiumMemberArea.js`, `app/api/members/stadium-premium/[place]/route.js` | 公開・会員領域の初期取得重複、60秒poll、auth初期通知。保護APIからtoday GETを直接関数呼出し | 公開表示pollだけ可視性制御を適用。直接関数呼出しは2つ目のHTTP InvocationではないがDB再取得はある。会員判定の統合は別途 | poll60/時→表示時間比率に比例。8時間中2時間表示なら480→120、推定75%減。初期取得の重複は今回残る |
| 10 高（潜在） | `app/api/admin/engine-v3/refresh/route.js`, `app/api/admin/stadium-ai-v2/refresh/route.js`, `app/api/ai-v2/settle-bets/route.js`, `app/api/live/openapi-preview/route.js`など | 高コスト/更新処理の認証ガード不足、GETでも更新する経路。外部アクセスや再試行で負荷増加し得る | 外部workerを洗い出して共通認可・適切なメソッド・idempotency導入を次段階に。今回無断で認証を追加すると外部ジョブ停止のおそれ | 現在の大量実行との因果は未確認。削減率未算出。未修正 |

## session、イベント、Strict Mode

`onAuthStateChange`登録は8箇所: `app/components/MemberSessionBridge.js`、`app/components/MemberEmailConfirmationHelper.js`、`app/members/page.js`、`app/members/discord/page.js`、`app/members/ichika-consult/page.js`、`app/members/ichika-hidden-escape/page.js`、`app/members/ichika-escape-surge/page.js`、`app/library/stadium/[place]/StadiumPremiumMemberArea.js`。登録8箇所すべてがsession POSTするわけではない。bridgeはrootで1個。クライアントのmemo化とunsubscribeはあり、レンダリングだけで数十回POSTする無限ループは確認できなかった。

mainではbridgeのgetSession初期化とINITIAL_SESSIONが並行し得る。SIGNED_INはログイン以外のセッション再確認でも届く。TOKEN_REFRESHEDは同じuserでも別tokenなので省略してはいけない。Strict Modeは開発時のeffect追加実行要因であり、本番の大量発火原因と断定しない。雑誌の独立POSTとヘルパー経由を横断して抑制するのがPR85。

PR85の期待値: 同一有効tokenのINITIAL_SESSION/getSession/SIGNED_IN同時要求は合計1 POST。成功済み同一tokenの短期再通知は0。TOKEN_REFRESHEDでtokenが変われば1。SIGNED_OUTは必要なDELETEでCookieを消去。ユーザー切替・更新tokenの要求を旧in-flight Promiseに混ぜない。失敗を成功としてキャッシュしない。API側で同じ処理を早期returnしてもInvocation自体は既に発生するため、中心はブラウザ側の同期統合とする。

サーバーsessionの検証・会員認可は維持。レスポンスを共有CDNへ載せない。複数クライアントのsingleton化や全auth callbackの書換えは別の回帰リスクがあり今回行わない。Supabase auth callback内の非同期getSession/DB参照も今後整理する。

## 全体監査の補足

- 全APIのメソッド、直接参照、定期実行、dynamic設定、認証検出語、キャッシュ候補はinventory参照。認証語の不在を未認証と決めつけず、import先のguardを確認する必要がある。管理schedule/realtime/results/ticker/syncは共通ヘルパーの認可経路も確認対象。静的解析で未参照でも外部workerから呼ばれる。
- cookies()/headers()を使う会員ページ、queryで日付を変えるschedule、検索条件付きnewsを一律static化しない。rootはforce-dynamicだが、note/月次統計に既存短期キャッシュがあり、全面変更より公開部分の分割が次候補。
- SSRとClientの同一データ取得は競艇場公開/会員領域が候補。Client ComponentそのものはFunctionを発生させない。DOMタイマーやuseEffectを全て削除する修正は不要。
- repositoryにMiddleware/Proxyファイルはなく、広すぎるmatcherの実行増加は確認されない。Vercel側の設定は別途メトリクスで確認する。
- next/image importは10箇所、動的SNS画像APIはEdge ImageResponse。画像変換数・キャッシュ読込はFunction Invocationと別指標。Discord avatarのファイルproxyは既存max-age=3600。`app/discord-assets/hatsune.jpg/route.js`はapp/api外のRoute Handlerなので別途対象に含めた。
- 雑誌ページ画像は認証付きAPI・Storage取得がページ数に比例。公開キャッシュは禁止。短命署名URLへの切替は会員失効時の閲覧継続リスクがあるため保留。雑誌一覧の署名URLも有効期限があるため、単純ISR化しない。
- Discord429のretryは有界、無限retryは確認できない。収集処理の複数候補URLも有限。定期Cronの失敗継続はJavaScriptの無限ループとは区別する。音声通知付き管理画面の背景pollは通知要件があるため今回は停止しない。
- package.jsonでNextがlatest、lockfileなし。ビルド再現性にリスクがあり、今回の検証はNext16.3.5。コスト監査に便乗して依存を一括更新しない。

## Supabase直接取得の境界

本番RLSの読取確認に基づく。直接取得へ実装移行はしていない。

| データ | 判定 | 理由 |
|---|---|---|
| bs_race_events / bs_race_entries | 公開列を限定すれば候補 | SELECT policyが公開。巨大payloadや集計負荷は別途検証 |
| realtime_updates / weekly_schedule | 公開条件付き取得またはCDN候補 | active/published_at、published条件。今回realtimeはAPIを維持してCDN追加 |
| bs_member_profiles / preferences | 自分のデータ取得は候補 | auth.uidとuser_idのRLS。課金権限の判断をブラウザへ移さない |
| bs_ai_predictions | 直接取得拡張を保留 | published条件のpolicyに加えpublic true policyが存在。RLS policyはOR結合なので未公開保護を別途点検 |
| ai_jobs / official predictions | サーバー経由維持 | RLS policyなしのため通常クライアント取得不可。service roleをクライアントへ渡さない |
| LINE/Discord秘密鍵、会員権限、署名付き雑誌画像、通知・更新 | サーバー経由維持 | 秘密情報、認可、配信冪等性が必要 |

## Cron / 外部定期処理

vercel.jsonの20エントリは元設定で計1,176回/日、setup減速後912回/日（全Cronの推定22.4%減、264回/日）。UTC・1日全スロットが起動する仮定で、実請求回数ではない。

| Vercel経路末尾 | 元の設定上回数/日 | 変更後 |
|---|---:|---:|
| discord-alerts | 450 | 450 |
| discord-race-threads | 192 | 192 |
| discord-community-setup | 288 | 24 |
| discord-membership-sync | 24 | 24 |
| discord-community-poll | 1 | 1 |
| elimination-odds-snapshots | 90 | 90 |
| media-editorials | 4 | 4 |
| news-morning-collect / data-lab-social | 各1 | 各1 |
| race-cancellations | 5 | 5 |
| news-verify / news-x-drafts | 各6 | 各6 |
| news-short-draft / daily-result-digest | 各1 | 各1 |
| news-editorials | 4 | 4 |
| x-night-candidates / x-night-posts | 各1 | 各1 |

Supabase cron.jobも読取確認。exhibition420、LINE420、hidden/inner/surge各280、hatsune news3、previous-day-health3でVercel向けHTTP約1,686/日。別にDB/Edge向けopenapi-live280、boat4-double-top評価420、ニュース/メディア各4、official performance17、週次engine/日次validationがある。これはvercel.jsonだけでは見えない実行。GitHub hatsune workflowは手動起動。AI生成約288/日はログから5分間隔と推定される外部workerであり、このrepositoryにはそのscheduler実装がない。

LINE WebhookやDiscord通知は送信重複の有無をmessage/event IDで追跡する必要がある。今回配信APIを実行しての試験はしていない。

## 変更ファイル・検証

| ファイル | 変更 |
|---|---|
| vercel.json | community-setupだけ毎時17分へ |
| app/comic/page.js / app/ichika-sensei/page.js | ISR300秒・RSS timeout10秒 |
| app/api/home/realtime/route.js | 公開正常応答のみCDN30秒、失敗no-store |
| app/components/HomeCompactRealtime.js | ブラウザfetchのno-store指定を除去 |
| app/lib/visiblePolling.js | 非表示停止、in-flight抑制、復帰時の期限判定、cleanup |
| app/bsc2/admin/page.js | 共通poll、選択ID依存の余分なeffect起動除去 |
| app/bsc2/admin/ai-factory/page.js / app/admin/sync/SyncDashboardClient.js | 共通poll |
| app/library/stadium/[place]/TodayRacePremium.js | 共通poll、初回loadingの終了を保持 |
| supabase/migrations/20260914110009_fix_official_prediction_generated_investment.sql | 自動計算列への明示INSERTだけ除去。本番未適用 |
| tests/visible-polling.test.mjs / tests/home-realtime-cache.test.mjs / tests/generated-investment-regression.sql | 背景/復帰/並行/失敗回復とDB固定買い目の回帰試験 |
| scripts/audit/vercel-inventory.cjs / docs/vercel-usage/* | 再現可能な全件一覧と本報告 |

実施: visible polling 3件、公開API正常/障害キャッシュ2件、既存レース展示表示23件のNodeテスト計28件成功。一時テーブルSQLでinvestment=200、無効/重複買い目除去、更新後も公開snapshot維持を確認しROLLBACK。本番テーブルの書換えなし。Next production compile成功、TypeScript処理成功。ビルド全体は環境にNEXT_PUBLIC_SUPABASE_URL等がなく既存/admin/discord-replies等のprerenderで停止。従ってフルビルド成功とは報告しない。

未実施: 実ユーザーでの通常ログイン、課金状態変更、LINE/Discord送信、実ブラウザの全画面E2E、Vercel本番でのCDNヒット・ISR判定。PR85の9認証同期テストは別PRの証跡。今回ログイン経路を追加変更していないことと、既存機能全てのE2E成功は同義ではない。

## デプロイ後の確認・継続監視

1. 変更を分けて反映。まずCron減速、次に可視性pollと公開キャッシュ、DB修正はSQL回帰試験後にmigration適用。PR85の認証修正も独立反映し、反映SHAと時刻を記録。
2. Vercelで同じ曜日/時間帯の24h・7日を比較。requestPath+method別Invocation、Function duration/CPU、5xx/429、p95、cache HIT/MISS/BYPASS、ISR再生成、Edge実行、画像変換・転送量を確認。総件数だけでなく100 pageviews・100ログイン当たりで正規化。
3. sessionはsource、auth event、結果（sync/dedupe/failure）、request ID、匿名のセッション相関IDを計測。token、Cookie、メール、Authorizationをログへ出さない。同一相関IDの10秒内POST、1分burst、TOKEN_REFRESHED後の401、有料会員判定失敗を監視。ブラウザで抑制した数はサーバーログだけでは分からないのでサンプル付きクライアント計測を検討。
4. 初期の警報案: sessionが同一相関IDで10秒内3回超、routeの5xxが5分で5件超、Cron3回連続失敗、Invocation/pageviewが7日同時間帯中央値の2倍。これらは仮閾値。運用1週間で調整し、通知を新規送信する設定は今回作っていない。
5. Cron台帳をVercel/Supabase/Windows/GitHub横断で管理し、担当・頻度・目的・最終成功・冪等キーを記録。Discord setupの403は権限回復まで失敗継続し得る。LINEの検出から送信までの遅延と重複通知も別指標にする。
6. キャッシュ導入後は公開更新→表示の遅延、非公開化後の残存時間を確認。認証Cookie・会員応答にpublic cacheが付いていないことを回帰チェックする。poll修正後は復帰1回・遅い通信時非重複・手動更新成功をブラウザNetworkで確認。

## 残存リスク

日次の正確な削減率はログだけから断定不可。ルート内early-return/DBキャッシュはInvocationを消さず、実行時間だけ減らす場合がある。visiblePollingは各マウント内の自動pollの制御であり、Strict Modeの再マウント、手動更新、別タブをまとめるsingle-flightではない。キャッシュキー/地域によりMISSが複数生じる。DB migration未適用の間AI保存障害は継続。Discord権限エラーもCron減速だけでは解消しない。未保護の高コストAPI、RLS公開policy、外部worker重複は次の個別修正対象として残す。

技術仕様確認: [Supabase auth events](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)、[Vercel Cache-Control](https://vercel.com/docs/caching/cache-control-headers)、[Next.js ISR](https://nextjs.org/docs/app/guides/incremental-static-regeneration)。
