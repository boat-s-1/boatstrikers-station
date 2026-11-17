# PHASE 14 legacy JWT失効 最終事前確認（2026-11-01）

判定: **HOLD / 今回は失効実行不可**。基準コミット ecb74bd014482a758a95d15567574b88b2d29e44。
読み取り専用調査を実施。キー失効・再発行・ローテーション、previous HS256 retire、関数の実行・変更・削除、本番DB/環境/Cron変更は実施していない。

## 今回の追加実測

ログ対象期間: 2026-10-31T06:00:00Z ～ 2026-11-01T02:01:36.950Z（UTC、約20時間）。関数を呼び出してログを生成したものではない。

| 項目 | 結果 |
| --- | --- |
| 隔離 unified logs | edge 11、auth 27、postgrest 287、storage 5、realtime 12、pgbouncer 98、postgres 120 |
| 隔離 Function / Function edgeログ | 対象期間のsource一覧にいずれもなし |
| 隔離 HS256通信 | 3件。POST /admin/v1/network-bans/retrieve、200、apikey/Bearerともrole=supabase_admin |
| 隔離 service_role / anon利用 | edge 11件内に当該roleなし。管理用supabase_adminを旧service_role利用と扱わない |
| その他edge通信 | JWKS GET 1、Auth health GET 3、REST-admin ready GET 3/HEAD 1。いずれも200 |
| 隔離Auth | users / sessions / refresh_tokens = 0 / 0 / 0 |
| 隔離Storage | buckets / objects = 0 / 0 |
| 隔離DB依存 | cron.jobなし、Vault 0、hooks 0、HTTP webhook trigger 0、public関数内の対象ref/関数名のliteral参照0 |
| 隔離news/mediaテーブル | 両方なし。ACTIVEは業務処理成功を意味しない |
| 隔離チャート | 0艇。今回保存していない |
| 旧Preview | dpl_2gLUhD5r39bDkzb1D7Lerk8p8buX の管理API GETは404 |
| Vercel | 75変数、一時3変数0、Deployment Protection enabled / all_except_custom_domains |
| 本番データ | 198R / 1,188艇、重複group 0、不完全race 0 |
| 隔離legacy anon設定 | disabled=false。modern publishable defaultもdisabled=false。キー値は保存しない |

**ログの限界:** 0件は未使用の証明ではない。時間範囲外、非稼働クライアント、外部CI/個人端末/未公開連携の設定は残り得る。postgrest等の件数は起動・管理ログを含み、全件を利用者API呼出し数と見なさない。HS256管理通信の署名鍵がpreviousと同一かは非確認。内部管理通信への影響なしも断定しない。

## news v13 / media v2 の入口と内部DB認証

両関数の管理メタデータ・取得ソースを再確認。version、verify_jwt、bundle hashはecb74bdの証跡と一致。

| 関数 | 入口 | 内部認証 | 副作用 |
| --- | --- | --- | --- |
| collect-boatstrikers-news v13 | verify_jwt=true、POSTのみ。handler内にrequest認証/role検査なし | SUPABASE_URL、SUPABASE_SECRET_KEYS、GEMINI_API_KEY、GEMINI_MODEL | Google API、bs_news_candidatesへのINSERT |
| collect-boatstrikers-media v2 | verify_jwt=true、POSTのみ。handler内にrequest認証/role検査なし | SUPABASE_URL、SUPABASE_SECRET_KEYS | YouTube RSS、bs_media_videosのupsertと120日超DELETE |

SUPABASE_SECRET_KEYSはJSONのdefault、なければ最初の値を選ぶ。両ソースはlegacy SUPABASE_SERVICE_ROLE_KEYを読まない。ただし**内部DBアクセスのmodern化と入口のlegacy依存は別**。内部RESTはapikeyに加えBearerにもmodernキーを設定しているため、移行時は現行仕様に合わせapikeyのみの経路を検証する必要がある。今回はその実行可否を実測していない。

legacy anon/service_roleを停止しprevious HS256の信頼を除くと、それで認証している隔離の外部呼出し元・旧ユーザーJWTは拒否され得る。内部modernキーは旧JWTとは別ライフサイクルだが、runtime SUPABASE_URL / SUPABASE_SECRET_KEYSの実値・有効性を実行で確認していないため、失効後も正常稼働するとは判定しない。入口にはservice_role限定認可もない。

## 本番との分離・呼出し元

管理APIのbranch一覧で隔離ref=rdqnqvafsponsoetnezv、parent=rzosrbkyniyedolhkgxo、with_data=falseを再確認。隔離はMIGRATIONS_FAILED / ACTIVE_HEALTHY。reset/rebase/mergeは行わない。

本番cron.jobは24件、command内に隔離refのliteral参照0件。以下は**本番向け**で、停止・変更禁止。

| job | schedule (GMT/UTC) | 接続先 | 認証設定 |
| --- | --- | --- | --- |
| 11 news | 0 3,6,9,14 * * * | 本番ref | Bearer、Vault参照あり |
| 12 media | 0 3,6,9,13 * * * | 本番ref | Bearerとapikey、Vault参照なし |

同期間の本番Function edge記録はnews 3 / media 3、各200、hostは本番ref、caller_role=anon、algorithm=HS256。このため本番側legacy認証は現役。隔離のキー処理を本番へ流用してはならない。cron command、Vault内容、JWT文字列は出力していない。

PR headの再帰tree 2,254件を取得、truncated=false。そこから全8 GitHub Actions workflow、lib/newsCandidateAutoPublisher.js、既存news cron migrationを読み取り専用で追加点検。10ファイル内に隔離ref・対象2 Edge Function名の直接参照なし。workflow内の共通Supabase/CRON secret参照、news publisherの共通URL/service-role使用は存在し、値は取得しない。全リポジトリ本文・GitHub secret値・全外部連携を網羅した検証ではない。

両関数ソースに本番/隔離refのhardcodeなし。artifactのentrypoint_pathに本番refが含まれること自体はruntime本番接続の証明ではない。実際のruntime環境変数の安全なattestationは引き続き未検証。前回の管理画面再認証制約と、コネクターにruntime secrets一覧/安全なattestation機能がない制約を解消していない。別の関数をデプロイして確認する操作は今回行わない。

## 移行の選択肢と停止条件

A. **隔離の旧呼出し元の停止を受容して失効**: 所有者が未確認consumerを含む停止リスクを了承し、下記preflightが揃った場合のみ別途承認後に実施。news/mediaが失効後も呼べることは約束しない。既存news/mediaの実行は復旧確認に使用しない。

B. **無停止を要件にする**: 隔離だけの別途変更承認で、関数入口を明示的な認可（例: withSupabase auth secret:専用名）へ移行し、対応するapikeyを呼出し元で利用する。verify_jwt=falseだけの変更は禁止。先に拒否系・接続先attestation・副作用なしの認証確認を設計し、移行先での認可と呼出し元更新を検証してからlegacyを無効化する。関数変更、専用modernキー発行、外部設定変更、検証実行はそれぞれ承認範囲を明確化する。今回実装しない。

defaultのmodern secretを無目的にrotateしない。両関数の内部DB接続に影響し得る。named keyを作るだけでは現在のdefault優先selectorは切り替わらない。本番の共通キー・Cronは移行対象外。

## 実施直前チェックリスト（全項目を満たすまで実行しない）

1. 対象ref=rdqnqvafsponsoetnezvと所有branchを管理画面で再確認。本番refは操作対象から除外。
2. API Keysのlegacy状態、現行ECCとprevious HS256の識別子・状態を値非表示で再確認。previousの旧証跡IDは293ec587-d84c-44d4-ab23-3532e2bae8b6であり、実行直前の状態確認を代替しない。
3. runtime接続先/modern keyの有効性を安全に確認するか、隔離news/media等の停止受容を明示。supabase_admin管理通信への扱いが不明ならプラットフォーム側に確認する。
4. 外部consumerの所有者確認、または未確認consumer停止リスクの明示受容。全8workflow確認だけで完了にしない。
5. 旧Preview404、環境変数75/一時3件0、保護維持、本番198R/1188艇とCron不変を再確認。
6. 隔離legacy **anonとservice_roleの両方停止**、およびprevious HS256信頼取消の影響・不可逆性を含む個別承認を得る。今回の依頼はこの承認ではない。
7. 失効前後に使う秘密を出力しない検証手段を確保。副作用のない隔離専用の既知read-only endpointに限定し、Edge Functionsは実行しない。利用するキーを正規の認証で取得できない場合は停止。

## 承認後の失効手順（今回は未実施）

1. 隔離プロジェクトAPI Keys画面でlegacy anon/service_roleをdeactivate。modern default、現行ECC、本番を変更しない。
2. 別承認のprevious HS256取消を隔離プロジェクトで実施。APIキーdeactivateだけで全JWT検証経路の失効完了としない。
3. 各操作後に対象ref、状態、時刻のみ記録。反映/キャッシュ待ちは実施時点の公式仕様に従い、固定秒数や即時完了を仮定しない。
4. エラーや対象不一致なら次の操作へ進めずHOLD。旧キー/新キーをログ、画面写真、GitHub、チャットへ出さない。

## 事後確認と復旧

- legacy両キー非有効、previousが信頼対象外、現行ECCとmodern keyは維持を管理メタデータで確認。
- 正規に確保した旧キーで隔離の既知read-only endpointへのアクセス拒否をstatusだけ記録。キーの種類/送り方が不正なことによる拒否と区別する。必要なAPI経路を網羅できなければ失効完了の保証を限定する。
- modern keyで同じ隔離read-only endpointの許可を確認。これで関数入口の認可やnews/mediaの正常保存までPASSにしない。
- 旧Preview404、75変数/一時0、保護、関数version/hash、本番データ・Cronの保全を再集計。
- 予期せぬconsumer停止は、そのconsumerだけを承認済みのmodern認証へ前進移行する。漏えいした旧キー再有効化は安全な復旧ではない。previous取消の可逆性を仮定しない。
- 本番キーrotate、branch reset/merge、旧Preview復活、関数POST、テーブル作成を復旧手段に含めない。追加の変更は別途承認を必要とする。

## 未検証と最終実行可否

**HOLD継続**。runtime秘密のbinding/有効性、全外部consumer、previous鍵の直前状態、失効後実動作は未検証。ログ追加調査は失効後成功テストではない。過去の回帰テスト結果を今回再実行したPASS数に加算しない。本番導入・自動収集の統合検証HOLDも解除しない。

次に必要なのは、Aの隔離旧認証停止受容と限定失効の承認、またはBの隔離限定認証移行調査・実装の承認。前提が未解決のまま無停止の失効GOは出せない。PRはDraftを維持する。

## 参照（取得日2026-11-01）

- https://supabase.com/docs/guides/security/rotate-leaked-api-keys
- https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys
- https://supabase.com/docs/guides/auth/signing-keys
- https://supabase.com/docs/guides/functions/secrets

公式資料はlegacyペア停止とlegacy JWT secretの信頼取消を区別する。modern keyをBearerに置き換えるだけでは関数入口の安全な認可移行とならない。changelog.mdの取得はcontent-type制約で失敗し、関連公式ガイドを直接確認した。
