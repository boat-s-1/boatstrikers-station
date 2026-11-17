# PHASE 14 隔離旧認証・限定失効実行計画の確定
確認日: 2026-11-01 JST（記録UTC 2026-11-01T02:42:25.276Z）
基準: ae537fcd0b13b75fc73e3431fb9ceb004a91f948

## 判定
**限定失効の対象・操作計画は確定。実行はHOLD / 別途承認待ち。**
無停止GOではない。隔離旧JWT consumerの停止リスク受容、秘密非表示の事前/事後比較経路の確保を実施条件とする。今回は失効、rotation、previous retire、Edge Function実行/変更、本番変更を行っていない。PRはDraft維持。

## 前回から解消した確認事項
Supabase管理画面を正規のGitHub再認証で開き、URL・PREVIEW branch表示を確認した。前回の「previousの現在状態を管理画面で読めない」という障害は今回解消した。キー値はReveal/Copyせず、UIテキストはJWT/APIキー文字列を除去して観測した。スクリーンショットは採取していない。

| 対象 | 現在状態と根拠 |
| --- | --- |
| project | rdqnqvafsponsoetnezv / gamagori-pr294-phase13 / PREVIEW |
| legacy anon / service_role | 管理画面に両キー欄とDisable JWT-based API keys操作が存在し、有効状態。anonは管理APIでもdisabled=false |
| 現行署名鍵 | Current / ECC P-256 / 131ca443-c615-476a-9168-27088b1d4922 |
| 旧署名鍵 | Previous / HS256 Shared Secret / 293ec587-d84c-44d4-ab23-3532e2bae8b6。画面上、期限内JWTの検証用に残存 |
| modernキー | Publishable default、Secret defaultが管理画面に存在。値は未取得、有効API呼出しは未検証 |
| Custom secrets | 0件（No custom secrets created） |
| Default secrets | SUPABASE_URL、SUPABASE_DB_URL、SUPABASE_PUBLISHABLE_KEYS、SUPABASE_SECRET_KEYS、旧ANON/SERVICE_ROLE、JWKS等を管理画面で確認。値未取得 |

参照画面:
- https://supabase.com/dashboard/project/rdqnqvafsponsoetnezv/settings/api-keys/legacy
- https://supabase.com/dashboard/project/rdqnqvafsponsoetnezv/settings/jwt
- https://supabase.com/dashboard/project/rdqnqvafsponsoetnezv/functions/secrets

## 関数入口と新方式呼出しの可否
取得済み実デプロイソースを再取得・確認。news v13とmedia v2はverify_jwt=true、bundle hashはae537fcと一致。両handlerはPOST限定、request header/roleの明示的認可なし。内部DBはSUPABASE_URLとSUPABASE_SECRET_KEYS（default優先、なければ最初の値）を使い、legacy service_role環境変数は読まない。本番/隔離refのhardcodeなし。

公式移行資料には、verify_jwtはlegacy JWTのみ理解するという説明と、互換性のためmodern keyのBearerを通す場合があるという説明が併存する。後者でも「ゲート通過は呼出し元の認証ではない」と明記される。したがって**modern keyで現関数が安全に認証付き実行できると判定しない**。今回は関数を一度も実行せず、401/200の実測結果を捏造しない。

新方式への安全な入口移行には、明示的なsecret認可（例: withSupabase auth secret:専用名）とapikey利用を先に設計・検証する。verify_jwt=falseだけの変更は禁止。関数変更は今回の許可範囲外であり、この方法は別承認の代替案。

## 実行時環境と分離の再確認
管理画面のDefault secretsはプロジェクト用の予約設定で、隔離側Custom secretsは0。本番値をコピーして設定した形跡は今回の一覧にない。関数一覧の公開URLも隔離ref。branch管理APIは隔離refと本番parent ref、with_data=falseを返した（MIGRATIONS_FAILED / ACTIVE_HEALTHY継続）。本番/隔離は別インスタンスとして確認できる。

ただし、管理画面の予約変数名の存在は、実行中isolateの実値・有効性の測定ではない。関数実行によるruntime attestationは未実施。本番接続先への転送・全外部連携が絶対に存在しないという証明までは行えていない。

**追加の既存制約:** 隔離Custom secrets 0件なのでGEMINI_API_KEYも設定されていない。newsコード101行は未設定時503を返す。この503はコードと設定からの予測であり、実呼出しはしていない。隔離bs_news_candidates / bs_media_videosも存在しない。したがって両関数の正常業務実行は旧鍵失効前から確認不能であり、失効テストにPOSTを利用しない。

再実測SELECT:
- 隔離Auth users=0、sessions=0、Vault=0、cron.jobなし、chart boats=0。
- 本番198R / 1,188艇、不完全race=0、cron jobs=24、cron command中の隔離ref literal=0。
- Vercel環境変数75件、一時3変数0（decrypt=false、値非出力）。本番/Development/他Previewを含め変更なし。
- 旧Preview削除404、前回の重複0・全8workflow等の依存調査結果はae537fcから継承。今回は旧Previewや全workflowを再測定したとは扱わない。

## 未知consumer停止リスク
停止対象は隔離legacy anon/service_role、それで署名された旧JWTを利用する外部スクリプト、CI、Webhook、個人端末、休止中アプリ等。前回の限定ログ期間で利用なしでも、設定がないことは保証しない。本番向けnews/mediaのHS256 anon利用は前回実測済みであり、本番は一切対象にしない。前回隔離にあったsupabase_admin HS256管理通信は旧service_role利用と区別し、その署名鍵や内部処理への影響は未確定。

限定失効は未知の隔離consumerが止まる可能性を受容したセキュリティ措置として実施可能な候補であり、「何も止まらない」との保証を伴わない。

## 実行計画（今回は未実施）
1. **承認対象を固定**: rdqnqvafsponsoetnezvだけのlegacyペア停止と、previous HS256 ID 293ec587-d84c-44d4-ab23-3532e2bae8b6の信頼取消。現行ECC ID、modern default、本番ref、Vercel、Cron、関数は変更対象外。未知consumer停止・previous取消の不可逆リスクを承認文に含める。
2. **直前確認**: branch/refとCurrent/Previous ID、legacy有効状態を再読。対象不一致、状態変化、親本番へ移動した場合は停止。UI上のpreview設定制限や親側操作が要求された場合も停止し、親を変更しない。
3. **比較経路確保**: 正規に取得した隔離旧anon/旧service_role/modern secretを秘密保護されたメモリ内でのみ扱う手段を確保。値をチャット、ファイル、GitHub、shell引数、ログ、写真へ出さない。手段を確保できなければ失効操作へ進まない。キー発行や本番キー利用で代用しない。
4. **事前対照**: 隔離のみの既知read-only経路を使う。anonはGET /auth/v1/settingsのapikey経路、service_role/modern secretはGET /rest/v1/bsc_gamagori_chart_ratings?select=boat_no&limit=0を候補とし、実施前に正規ヘッダーで成功対照が得られることを確認。HTTP statusと件数のみ記録し、レスポンス本文/キー非出力。RLSや権限で元から拒否される経路は失効証明に採用しない。
5. **操作A**: 隔離のAPI Keys > LegacyでDisable JWT-based API keys。確認画面の対象・影響を再読し、許可範囲が異なれば中断。modern secretは変更しない。
6. **操作B**: 隔離のJWT Keys > Previously used keysから対象IDだけを信頼取消。実行時UIのRevoke/Retire名称と対象IDを確認し、現行ECCのrotate/create standbyは触らない。今回はそのメニューや確認ダイアログを実行していない。
7. **事後確認**: legacy両キー無効、previous信頼対象外、Current ECC/modern維持を確認。事前成功した同一read-only経路・同一形式で旧認証の拒否とmodern認証の成功を比較。公式の反映/キャッシュ期間を実施時点で確認し、即時反映や固定秒を仮定しない。
8. **保全確認**: 本番198R/1,188艇、重複/欠損、24Cron、本番向け設定、75変数/一時0、関数version/hash、旧Preview404を再点検。成功したread-only認証比較を関数入口/正常収集PASSへ転用しない。

管理UIの操作が権限不足・branch制限で不可能なら、権限を増やしたり本番設定へ迂回しない。現時点ではfinal mutationの権限・確認画面まで保証していない。

## 安全な復旧・代替策
- 未確認consumer停止時は、その隔離consumerだけをmodern認証へ前進移行。旧キー再有効化は残存した資格情報も復活するため、安全な復旧策ではない。previous取消を巻き戻せると仮定しない。
- runtimeエラーは失効由来と既存のGemini欠如・テーブル不在を分けて診断。本番secretのコピー、news/media POST、branch reset/rebase/mergeによる復旧は禁止。
- 無停止が必要なら、限定失効を保留し、隔離だけの入口認可移行を別途承認してから実装・検証する。今回の関数変更禁止は維持。
- 安全な検証経路や最小権限操作が確保できない場合はHOLD継続。隔離branch自体の廃止が必要なら別途、バックアップ/依存/費用を調査して承認を得る。削除を今回実行しない。

## 実行可否の結論
**計画策定・現在状態確認は完了。限定失効の自動実行はまだ不可。**
管理画面へのアクセス障害は解消したが、秘密保護された事前/事後API比較経路は未検証、未知consumer停止受容と失効操作の承認はまだない。次回の承認は上記操作A/Bと隔離read-only比較を明記し、前提未達なら実行しない条件とする。本番導入判定とPR Draft/HOLDは変更しない。新しい回帰PASS数は付与しない。

参考（2026-11-01確認）:
- https://supabase.com/docs/guides/security/rotate-leaked-api-keys
- https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys
- https://supabase.com/docs/guides/functions/secrets
- https://supabase.com/docs/guides/auth/signing-keys
