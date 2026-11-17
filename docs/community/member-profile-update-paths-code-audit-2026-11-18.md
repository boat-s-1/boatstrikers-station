# 会員プロフィール更新経路・通知認証依存のコード監査（2026-11-18）

## 調査対象と限界
GitHub default branch main のコードを読み取り。対象は会員Auth/プロフィール/LINE/Discord/退会/利用回数API。DB本番設定は別の読み取り専用監査結果を参照。ここに列挙した以外の未検索・外部ジョブ・運用スクリプトの不存在を証明するものではない。

## 実際に確認した経路

| 経路 | プロフィールへの作用 | 実装上の権限 |
|---|---|---|
| Auth signup trigger handle_boatstrikers_member_signup | 初期行を作成。衝突時はemail/display_name/同意日時/updated_atのみ更新。plan等は初回値beta_premium/active/beta_member=true | DB SECURITY DEFINER |
| POST /api/line/webhook | LINE署名検証後、連携コードを照合し line_user_id,line_linked_at,updated_at を更新 | service_role |
| POST /api/members/line-link-code | 本人Auth検証、プロフィールのLINE連携状態を読む。未使用コードを削除し新規発行 | service_role、プロフィール更新なし |
| GET /api/members/entitlement / lib/memberEntitlement.js | plan/status/beta/premium_until/line/is_adminを読み取り、会員権限を判定 | service_roleでAuth getUserとプロフィールSELECT |
| POST /api/members/session | entitlementを読み、Auth tokenをHttpOnly cookieに設定 | プロフィール更新なし |
| POST /api/members/delete | Auth user削除。プロフィール行はAuth削除後のDB FK/trigger等に依存（今回未確認） | service_role Auth Admin |
| Discord start/status/callback/preferences/unlink | プロフィールのplan/status/premium_untilを読む。Discordリンク/OAuth stateテーブルは書くが、プロフィール列は更新しない | service_role |
| POST /api/members/feature-usage | 利用回数テーブルとRPCを操作。プロフィール更新なし | service_role |

## 重要な設計上の結論
1. 現在読めたアプリコードでは、プロフィール更新は主にsignup SECURITY DEFINER triggerとLINE webhookのservice_role更新。一般ユーザーが直接UPDATEする必要性を示すプロフィール編集APIは今回確認した会員ルート群には見当たらなかった。
2. LINE webhookはservice_roleで line_user_id,line_linked_at,updated_at のみ更新するため、anon/authenticatedのUPDATE権限を削ってもこの経路は権限上は維持できる見込み。ただし実環境回帰テストは未実施。
3. 会員のplan/status/premium_until/is_adminは entitlement とDiscord eligibilityの判定に使われる。ブラウザから直接更新できる権限は不要と推定されるが、管理者画面、決済Webhook、cron、外部運用ツールの書き込み経路を追加調査しなければ確定できない。
4. bsc2/context/AuthContext.js はFirebase Auth/Firestoreの別アカウント領域。BoatStrikers会員権限の正本として混同しない。
5. bs_try_consume_member_feature / bs_refund_member_feature はanon/authenticatedにEXECUTE権限なし。既存のservice_role経路を維持する。

## 権限修正の候補（未実行）
- anon/authenticatedから bs_member_profiles の全列UPDATE ACLを撤去し、必要なSELECTはRLS本人ポリシーのまま維持する。
- UPDATEを一部列だけ許す案を採る場合も、全テーブルUPDATE ACLと列UPDATE ACLの両方を棚卸しして、明示的にREVOKEしてから必要列のみGRANT。現状のように全16列の列UPDATE ACLが存在する場合、テーブル権限だけREVOKEしても列ACLが残る可能性を考慮する。
- LINE連携はservice_role経由のサーバー更新を維持。plan/status/premium_until/beta_member/is_adminはサーバー管理専用。
- 実行前に pg_default_acl、ビュー/RPC、Auth trigger、外部決済/cron/管理画面、FK on delete、監査ログ、実RESTを確認。
- まず隔離DBでmigrationを試し、A/B/anonの列UPDATE拒否、正規signup、LINE link、Discord entitlement、退会、feature usageの回帰テストを実施。rollback SQLも準備。

## 現在の状態
- 本番DB変更なし。GRANT/REVOKEなし。通知テーブル作成なし。
- PR #300はDraft。通知Auth probeはコード上の読み取り専用APIだが、実HTTP/実JWT統合検証は未実施。
- 通知DB/API/既読保存/Web Pushは未実装。
