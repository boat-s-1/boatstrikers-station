# PHASE 12 観測証跡の永続化と正常収集条件

2026-10-31 JST。本番導入判定は **HOLD**。
PHASE11の84件から45件追加し、**129 PASS / 0 FAIL / 0 skipped**。コレクター専用の追記型観測、隔離DBでの永続化・再送、Preview用の観測/監視APIを実装した。公式の肯定的な発売表示も実測できたが、当日の6艇展示・チャートは未公開で、正常保存とVercel実行経路は未検証。

## 実装と適用範囲

Supabase CLIのmigration newで生成した `20261031051251_gamagori_append_only_observations.sql` に、新規 `public.bsc_gamagori_observations` と専用RPCを定義した。既存表・共有同期writerには変更しない。

**本番DBへのDDL適用は行っていない。** 本番デプロイ禁止を守り、migrationは作業ブランチに追加、実行は隔離PGlite（PostgreSQL WASM、package0.3.14）だけ。本番のto_regclassはNULLで、新表が未作成であることを読取確認した。Supabase管理DB/REST上の永続化を完了したとは報告しない。

| 観測列 | 意味 |
|---|---|
| id | 1回の観測ID。同じIDの再送は既存行を返し、内容変更は拒否 |
| race_date/race_no/stadium_number | 対象日、1〜12R、蒲郡7固定 |
| fetched_at | レスポンス採取完了時刻 |
| recorded_at | DBが付与する記録時刻。クライアント値は採用しない |
| source/source_url/html_sha256 | 取得方式、日付/R固定の公式直前URL、本文SHA256 |
| sources | 番組・日別index・直前・OpenAPIの各固定URL、本文ハッシュ、HTTP状態、受信時刻、Date、Age、分類済みエラー |
| boats | 艇番号、登録番号、展示値、進入。失敗時は参照DBの期待登録番号だけを残し、展示/進入はNULL。古いDB展示値を転載しない |
| validation_result/reason/sale_state | 内容検証成功、拒否、取得不能と分類理由。正常発売を未確認ならunknown |
| checked_at | **6艇の内容整合性の確認に成功した時刻**。正常発売確認時刻ではない。DBのみが付与 |
| collection_permitted | 常にfalseの生成列。観測だけで保存許可にならない |
| input_digest | canonical JSONのSHA256。同一IDの内容衝突を拒否するための識別子 |

## checked_atを付ける条件

アプリで本文SHA256を再計算し、公式番組の日/R/締切/6登録番号、日別indexの日付と対象R、公式直前の6登録番号/6展示、OpenAPIの同日・会場7・同R・6艇/6進入を照合する。公式とOpenAPIの展示値も一致必須。中止・順延・欠場・未知結果コードがあれば拒否する。

HTTP200は必要条件の一部にすぎない。4取得元すべての本文確認、受信時刻/HTTP Dateが120秒以内、Age0〜60秒、有効な展示5〜10秒、艇/登録番号/進入の一意性を検証する。HTTP Dateは内容更新保証ではなく、上記の本文検証と別に扱う。

SQLも6艇の値/一意性、4取得元の固定URL、ハッシュ形式と一致、HTTP情報、取得時刻を再検査する。verified_contentでも条件不成立ならINSERT自体を拒否する。checked_at/recorded_atの偽指定は使わない。DBはHTMLを再解析しないため、本文の意味・出所の確認は認証されたサーバーの検証処理を信頼する境界である。

失敗観測はchecked_at=NULLで追記する。同じ観測IDの再送では時刻を進めない。別の観測IDでソースを新規取得し、本文を再照合した場合は、本文ハッシュが同じでも新しい確認を記録できる。これにより「値が変わらないと同期時刻が進まない」既存writerの問題を共有処理の改変なしで避けられる。ただし既存オーケストレーターの鮮度判定を新表へ切り替える運用変更は、今回は行っていない。

## 権限とAPI

RLS有効。PUBLIC/anon/authenticatedは表とRPCの権限なし。service_roleはSELECT/INSERTと専用SECURITY INVOKER RPCだけ。UPDATE/DELETE/TRUNCATEを付与せず、ownerによる誤更新も追記専用トリガーで拒否する。最新試行用と内容確認済み用に索引を分けた。元のチャート表を更新・削除する処理はない。

新規 `/api/admin/gamagori-chart-observe` はPreview/API認証限定。本番では404。

- POST {"race":1}: 当日固定・1R限定・入力128 bytes上限。新表なしは公式アクセス前に503。既存の120秒リースを共有し同時実行を抑止。公式3ページとOpenAPIを直列に取り、間隔1.5秒、各5秒、全体35秒、サイズ800KB/2MB上限。失敗時に追加ソースを取らず、観測の取得に即時再試行はしない。
- GET ?race=1: 最新観測と、最終内容確認時刻を独立に取得。最新失敗を過去の成功で隠さず、collection_permitted=falseを返す。

どちらもチャートコレクターを呼ばず、Cronを登録しない。本番キー・環境変数・Deployment Protectionを変更していない。

## 公式の正常発売根拠の実測

**肯定的な表示を発見した。** 認証不要のBOAT RACE公式 `https://www.boatrace.jp/owpc/pc/race/index?hd=20261031` を14:18:21 JSTに取得。ページ更新時間14:18、蒲郡の画像/会場07リンクと当日hdを含む同一tbodyに「1R以降 発売中」、対象1R締切15:21を確認した。単なる「投票」リンクより明確な公式表示である。

`gamagori-sale-audit.mjs` は日付付き更新リンク、会場07の一意な行、同日のraceindexリンク、対象Rを含む明示的な発売表示、ページ更新時刻・HTTP受信鮮度を照合する読み取り専用候補。14:18の実fragmentはsale_open_observedを返す。別会場、古い日付/更新時刻、将来時刻、重複行、曖昧な文言はunknown。中止/順延表示は優先する。

**この候補は収集許可に接続していない。** 会場単位の発売表示は6艇公開や欠場なしの証明ではない。蒲郡自身の予定indexや任意tickerを正常と推測する処理も戻していない。BOAT RACE一覧は従来Vercel iad1でHTTP timeoutしており、今回成功したworkspaceのプロキシ経路と同一ではない。実行環境で継続取得できる取得元・鮮度・異常時の反映を確立する必要がある。観測表のv1は正常発売状態を保存許可へ変換せず、sale_stateはunknownまたは陰性状態のみ。

## 当日の認証不要経路と実データ永続化

14:11に公式recomend1Rを認証なしでHTTP200取得したが、パーサーは完全6艇を確認できずunpublished_or_invalid。HTTP200を公開成功と扱わない。初回研究プローブではHTTPヘッダーの大小文字の取得ミスがありDateを記録できなかったため、このサンプルにHTTP鮮度の成功を主張しない。

14:17:58〜14:18:19に公式番組/index/直前とOpenAPIを別途正しいHTTP Date採取で取得。公式直前は展示0/6、OpenAPIは空preview、DBも14:18:32時点の全12Rでpreview_boats=0。番組の6登録番号は5321/3747/3905/3696/4094/3303。

採取済みのレスポンスを、その取得完了時刻に時計を固定して検証し、隔離したファイル永続PGliteへ再生した。six_boat_preview_unverifiedとして1件を追記、同一ID再送はinserted=false。DBを閉じて開き直し、1件の保持とchecked_at=NULLを確認した。これは**取得後のオフライン再生**であり、後刻にfreshな正常確認が成功したという主張ではない。

公開後の読み取り用に `scripts/gamagori-public-chart-probe.mjs` を追加。固定公式URLへ1GET、5秒/400KB上限、DB接続なし。公開後の実チャート成功保存は今回は未検証である。

## テストとデータ保全

| 項目 | 結果 |
|---|---|
| 単体・実fixture・回帰 | **129 PASS / 0 FAIL / 0 skipped**。既報84＋観測14＋発売候補7＋SQL16＋API handler8 |
| 隔離PostgreSQLでのmigration/RPC | PASS。6艇内容成功時のDB時刻、空preview/偽時刻/古いHTTP/不一致拒否、idempotency、役割制限、追記専用を実行 |
| 実中止・欠場 | PASS。2024-08-31の実中止fragment、10/7 7Rの実K0、K1/S系等の既知コードを優先。会場発売表示があっても許可しない |
| 当日採取済み応答の永続再生 | PASS（拒否観測）。1件保持、再送追加0、checked_at=NULL、チャート保存0 |
| 公式の肯定的発売表示 | 読取実測済み。BOAT RACE蒲郡行14:18。正常6艇・欠場なしを保証するものではない |
| 本番DBの不変性 | PASS。14:10→14:24、198R/1,188艇、MD5 c22b73061091abe02167d6b0f22ae238一致、重複0・部分R0 |
| 本番観測表の作成・REST/RPC実行 | **未実施**。migration未適用、to_regclass=NULL |
| 認証付きPreview API・正常保存・実再実行 | **未実施/未検証**。新しい認証キー不許可を守り、正常許可条件も未接続 |
| 公開後の当日6艇・チャート | **未検証**。採取時未公開、1R締切15:21 |
| Vercelから発売候補ソースへのHTTP取得 | **未実施**。前工程timeoutを解消済みとはしない |
| 本番マージ/デプロイ/Cron | **未実施** |

全回帰: `GAMAGORI_TEST_PGLITE_URL=file:///tmp/gamagori-p12-runtime/node_modules/@electric-sql/pglite/dist/index.js node --test lib/gamagori-chart*.test.mjs lib/gamagori-meeting-policy.test.mjs lib/gamagori-program-safety.test.mjs lib/gamagori-source-audit.test.mjs lib/gamagori-observations.test.mjs lib/gamagori-sale-audit.test.mjs tests/gamagori-observe-route.test.mjs tests/gamagori-observations.sql.test.mjs tests/discord-alert-delivery.test.mjs tests/ichika-one-head-only.test.mjs scripts/trinity/shadow-coverage.test.mjs`

初期追加テストの2件はテスト側の時計を関数で渡していないことが原因で失敗し修正した。上記は修正後の最終実行結果。既存TRINITY・ニュース・予想のコードや同期、チャート既存行、vercel.json、認証設定の変更0。新規Automation Bypass発行0。外部アクセスは少数の直列読取だけでバックフィルなし。

## HOLD解除条件

1. 隔離Preview DBへmigrationを適用し、管理Supabase/RESTで権限・再送・永続化を確認する。本番適用は今回対象外。
2. BOAT RACEの肯定的発売表示を実行環境で取得できる経路と、各Rの6艇/欠場/中止の鮮度・矛盾時の優先規則を実測する。読み取り専用候補を検証なしで許可へ昇格しない。
3. 6艇の検証済み観測をオーケストレーターの判断へ安全に接続する。既存値変更時刻を最後の観測時刻として使わない。最新失敗は古い成功より優先。
4. 公開後の当日6艇→正常公式根拠→チャート6艇保存→再実行追加0を認証付きPreviewで実測する。今はこれを実施済みとしない。

検証手順: gamagori-phase12-preview-test-plan-20261031.md。
証跡: gamagori-phase12-source-evidence-20261031.json、gamagori-phase12-persistence-evidence-20261031.json、gamagori-phase12-db-evidence-20261031.json、gamagori-phase12-tests-20261031.txt。
最終コミットとPreviewビルドの状態はPR #294に追記する。ビルドREADYをAPI正常保存のPASSには数えない。
