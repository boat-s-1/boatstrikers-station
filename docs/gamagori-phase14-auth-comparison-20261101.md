# PHASE 14 読み取り専用API認証比較
2026-11-01 JST。基準コミット e9b1d034811d674d4adc07d7f00b57b450b3b3f5。
**判定: HOLD。3種類の実API比較は未完了。失効操作へ進まない。PR Draft・本番導入HOLDを維持。**

## 実行結果
共通API: GET https://rdqnqvafsponsoetnezv.supabase.co/auth/v1/settings
API keyはapikeyヘッダー、Bearer置換なし、同一URL・同一GET。本文・応答ヘッダー・キー値は出力しない。

| 認証 | 実測 | 判定 |
| --- | --- | --- |
| キーなし（対照） | HTTP 401 | キーなし拒否を確認 |
| legacy anon | HTTP 200、期待するsettings JSON形状を確認 | 事前成功対照成立 |
| legacy service_role | 未実測 | HOLD |
| modern Secret Key | 未実測 | HOLD |

最終anon実測: 2026-11-01T03:09:08.697170+00:00（JST 12:09頃）。
キーなし1回、anon2回（安全判定の改善後に再実行）の計3 GET。関数・RPC・DB更新APIは呼んでいない。証跡JSONは最終anon実測を収録。匿名キーの値も出力せず、同一資格情報の比較用にSHA-256 fingerprintのみ記録する。

今回の検証器fixtureテストは**8成功 / 0失敗**。実API3種類成功を意味しない。過去のコレクター回帰結果へ加算しない。

## 何が完成し、何が未成立か
専用のserver-side CLI検証器 scripts/gamagori-auth-compare.py と安全性テストを実装した。Supabaseコネクターで取得した隔離anonを、値非出力・端末echo無効の入力経路で検証器へ渡し、実測200を得た。キーをコード、引数、ファイルへ埋め込んでいない。非秘密canaryで入力echoがないことを確認後に利用した。

**残る具体的な障害は承認不足ではなく、秘密の受渡し機能の制約。**
- 接続済みSupabaseコネクターのキー取得機能はpublishable/legacy anonのみ。legacy service_roleとmodern Secretを直接server-side検証器へ受け渡せない。
- 認証済み隔離管理画面は利用可能。current ECC/previous HS256の表示は変わっていない。ページのWebMCP機能を確認したが、利用可能なツールは0件。
- ブラウザー側には、管理画面の秘密を保持したままこのserver-side GETを実施する専用機能や、実行環境へ非表示転送する確認済み経路がない。ブラウザーの非公開認証ストレージ、セッション/APIの裏口利用、秘密のURL埋込み、ローカルWebフォームへの投入は行わない。
- modern Secretにはブラウザー利用の拒否仕様もあるため、ブラウザーの401をserver-sideのキー無効と判定しない。
- 比較経路がない状態でservice_role/modern SecretをReveal/Copyして残存させることも行っていない。

したがって**anon用の安全な実測経路は成立、秘密2種類を含む3者比較経路は未成立**。キー発行・環境変数追加・関数変更によって迂回しない。

## 検証器の安全設計
- origin/project/path/methodをコードで固定。プロジェクト変更、任意URL、POST、Edge Function、RPCに対応しない。
- 既存秘密保護プロセスからの1行JSON stdin、または実端末のgetpass非表示入力。非TTYでのgetpassとecho抑止失敗は安全停止。秘密のコマンドライン引数・環境ファイルを要求しない。
- legacy JWTのpayloadはproject refとroleの取り違え防止だけに利用し、署名検証済みとは扱わない。
- modern Secretはopaqueのため、文字列だけで所属refを証明できない。実施者は隔離管理画面から取得した既存キーであることを確認する。親本番のキーを流用しない。
- TLS検証を維持、redirectを追わない、timeout12秒、再試行なし、Cache-Control no-store。例外文字列・応答本文・ヘッダー・キーをログへ出さない。
- HTTP200に加え、settings JSONのexternalオブジェクトを確認する。200のエラー本文やHTMLを成功にしない。
- SHA-256 fingerprintにより事前・事後で同じ3資格情報を比較する。別の無効キーで旧キー拒否を偽装した比較や、別modernキーへの変更はHOLD。
- post比較は正しい隔離origin/path/methodの完全baselineが必要。今回の部分baselineはpost判定に使えない。
- postの旧認証拒否は401かつ既知のAPI key拒否メッセージをメモリ内で確認した場合だけ採用。一般401、403、timeout、5xx、redirectは失効成功にしない。メッセージ自体は出力しない。

テスト8件は、固定GET/3者同条件、異project/role拒否、redirect拒否、キー/本文の出力抑止、未入力/5xx HOLD、JSON形状異常、一般401/403/例外の非採用、完全baseline・同一fingerprint・modern成功必須を検証する。すべて合成fixtureで、既存関数を実行していない。

## 事前基準と失効後の判定基準
1. baselineは3者すべて同じAPIで200＋正しいsettings形状であること。キーなし401対照も確保する。1種類でも未実測ならHOLD。
2. 保存したsanitized baselineのorigin/path/method、3種類のfingerprintと出所を固定する。記録日時が古ければ、承認後の操作直前に新しいbaselineを取得する。
3. 将来の別承認後、隔離legacyペアを無効化し、指定previous HS256だけ信頼取消。現行ECC、modern default、本番、Cron、Vercel、関数は変更対象外。
4. 同じ資格情報・同じAPIで、両legacyは401＋API key拒否、modern Secretは200＋settings形状を確認する。
5. previous信頼取消、現行ECC維持、legacyペア無効の管理状態を別に確認する。Auth settingsの比較はapikeyゲートの証拠であり、すべてのJWT検証経路に対する信頼取消の証明ではない。スクリプトのrevocation_verifiedは常にfalseで、この限界を明示する。
6. キャッシュ/反映待ちは実施時点の公式仕様を確認。理由不明の拒否や成功、設定範囲の不一致、modern失敗があればHOLD。関数実行は禁止を維持する。

api_comparison=GOはこの限定的なAPI比較の成立だけを表す。失効操作の承認や、本番導入GOを表さない。

## 実行手順（既存キーを安全に保持できる管理端末が確保できた場合）
リポジトリの検証器を実端末で実行する。新キー発行は不要。

```sh
python scripts/gamagori-auth-compare.py > isolated-auth-baseline.json
```

既存の隔離3キーを端末の非表示入力で渡す。キーをチャットへ送らない。JSONはstatusとfingerprint等の非秘密情報だけで、baseline_complete=trueまで次工程に進まない。

将来の個別承認済み失効後のみ、同じ既存3キーで比較する。

```sh
python scripts/gamagori-auth-compare.py --phase post --baseline isolated-auth-baseline.json > isolated-auth-post.json
```

これらのコマンドはキーを変更せず、GETだけ行う。現セッションでは秘密2種類をこの経路に投入できていない。ユーザーの環境で実行したと仮定しない。

## news/mediaと外部呼出し元
e9b1d03の監査結果を継承。news v13/media v2はverify_jwt=true、handlerに明示的なrequest認可なし。内部DBアクセスのSUPABASE_SECRET_KEYS利用は入口認可を保証しない。今回、関数ソース/環境を再変更・実行していない。

隔離Custom secrets 0、GEMINI_API_KEYなし、news/media保存先テーブルなしという既存制約を、キー停止による障害と混同しない。新方式での安全な関数呼出しを必要とする場合、明示的な入口認可移行を別途設計・承認する。

未知の隔離旧JWTスクリプト・CI・Webhook・休止アプリは、限定失効後に停止し得る。過去ログ0だけでは不存在を保証しない。本番向けnews/mediaの認証や既存Cronは変更しない。旧キー再有効化は残存資格情報を復活させるため、安全な復旧策にしない。未確認consumerは必要時に承認した新認証へ前進移行する。

## 最終判定
**HOLD。** 今回は比較が成立していないため、失効操作の実行GOを出さない。次に必要なのは、既存隔離秘密2種類を安全に利用できるserver-side実行経路の確保と3者baselineの実測。その成立後にのみ、未知consumer停止リスクを含む限定失効・previous取消の個別承認を求める。現在の依頼は失効承認ではない。

本番DB・Vercel・Cron・Edge Functions・鍵設定は変更していない。前回198R/1,188艇・24Cron・75変数/一時0の保全結果を引き継ぎ、今回再集計したとは扱わない。

参考（2026-11-01確認）:
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/security/rotate-leaked-api-keys
