# PHASE 12 Preview統合検証の準備

本番導入HOLD。ここには未実行のPreview検証を含む。正常保存を済みと扱わない。

## 適用前提

- レビュー済みの観測migrationを隔離したPreview用DBへ適用すること。本番DBには今回は適用していない。
- 既存の認証済みアクセス手段を利用すること。新規Automation Bypass発行、保護解除、秘密値のログ出力は行わない。PHASE12では認証付きPreview APIを実行していない。
- 正常発売の肯定ソースを実行環境で検証すること。公式一覧の14:18の蒲郡行には明示的な発売表示を確認したが、Vercelでの同ソース取得は未検証/従来timeout。読み取り専用候補パーサーを収集の許可に接続していない。
- 既存の当日オーケストレーターはPHASE11の安全停止を継続する。観測のchecked_atやsale_open_observedだけで許可しない。

## 実行順と期待結果

| 手順 | 操作 | 期待結果・実施状況 |
|---|---|---|
| 1 | GET /api/admin/gamagori-chart-observe?race=1 | Preview/API認証必須。最新試行と最終内容確認時刻を別々に返す。handlerの隔離統合テスト済み、実Preview未実行 |
| 2 | POST同ルート、JSON {"race":1} | 1R限定、当日固定、最大128 bytes入力。専用schemaなしは上流取得前に503。既存の120秒リースを共有し、競合409 |
| 3 | 未公開・古い応答・中止・欠場 | 観測失敗を追記、checked_at=NULL、チャート取得/保存なし。fixture・SQL・handler検証済み |
| 4 | 6艇本文がすべて一致 | verified_contentでDBがchecked_atを付与。同じHTMLでも新規に本文照合した観測は別行。正常発売の許可は付与しない。成功内容は実fixtureを補完した合成ケースで隔離SQL検証済み、当日実データでは未達 |
| 5 | 同じ観測IDを再送 | inserted=false、行数/checked_at不変。本文変更を同じIDへ送ると拒否。SQL検証済み |
| 6 | 最新観測を失敗にする | 過去のchecked_atを変更せず、監視は最新失敗を隠さない。SQL・GET handler検証済み |
| 7 | 正常状態契約を実装・再照合後、当日収集API | fresh6艇＋公式正常状態＋完全6艇チャートで初回6艇保存。**未実装/未実測の許可契約が前提のため、今回は実行不可** |
| 8 | 同じレースを再実行 | skipped_existing、公式アクセス0、保存6艇のまま。既存collectorテスト維持。PHASE12の実Previewは未実行 |
| 9 | 保存直前の中止/欠場/取得失敗 | 0艇保存、安全停止、欠損監視へ。既存の6艇atomic insert・上書き防止・リース・retry/backoffの回帰を維持 |

## 認証不要の公開チャート確認

`node scripts/gamagori-public-chart-probe.mjs --date=2026-10-31 --race=1`

公式recomendの公開URLに1回だけGETする。既存の5秒/400KB上限を使用し、パーサーで6艇を検証する。DBクライアント・書込み・Bypassキーなし。HTTP200や公開済み6艇だけで開催/発売許可は返さない。PHASE12の14:11の取得は6艇未確認。公開後の実成功は未検証。

## 再現できる隔離テスト

実行環境: Node 24.22.1。PostgreSQL検証のためだけに、プロジェクト外へ `@electric-sql/pglite@0.3.14` を固定導入した。アプリのpackage/lockfileを変更していない。

`GAMAGORI_TEST_PGLITE_URL=file:///tmp/gamagori-p12-runtime/node_modules/@electric-sql/pglite/dist/index.js node --test tests/gamagori-observations.sql.test.mjs tests/gamagori-observe-route.test.mjs lib/gamagori-observations.test.mjs lib/gamagori-sale-audit.test.mjs`

全回帰コマンドはテスト記録と最終報告を参照。PGliteは隔離したPostgreSQL WASMエンジンであり、Supabase REST/RLSの本番実測と同一ではない。

`scripts/gamagori-observation-replay.mjs` は採取済みdocuments JSONとDB読取JSONをローカルDBへ再生し、同一ID再送後にDBを閉じて開き直す。生HTML入力は匿名フォーム値を含み得るためGitHubへ掲載せず、必要断片のfixtureとソースハッシュだけをコミットした。実再生結果のJSONは公開可能な観測メタデータのみ。

## 取り消し・運用停止

本番Cron・環境設定は未変更。Previewの観測POSTを呼ばなければ新しい通信/書込みはない。追加APIは本番では404。将来停止するときも既存観測行は削除・更新しない。今回のmigrationは既存表/既存writerを変更しない。通常の権限では観測UPDATE/DELETE/TRUNCATEを禁止し、停止後も証跡を保持する。
