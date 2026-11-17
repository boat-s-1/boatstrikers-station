# 会員機能のDB関数依存監査（2026-11-18）

本番Supabase `rzosrbkyniyedolhkgxo` を**読み取り専用**で調査。個人データ行・秘密値・トークンは取得していない。

## 会員登録トリガー
`handle_boatstrikers_member_signup()` は SECURITY DEFINER。auth.usersへの新規登録を契機に、`bs_member_profiles`へ user_id/email/display_name/plan='beta_premium'/membership_status='active'/beta_member=true/同意日時をINSERTする。既存行との衝突時はemail/display_name/同意日時/updated_atを更新する。これは**一般会員がプロフィールの全列をUPDATEできる必要性を示すものではない**。ただしSECURITY DEFINER関数の実権限と回帰動作は隔離環境で確認する。

## 会員機能の利用回数DB関数
- `bs_try_consume_member_feature(p_user_id,p_feature_key,p_usage_date,p_limit)`：`bs_member_feature_usage_daily`の利用回数を追加、上限超過時は拒否
- `bs_refund_member_feature(p_user_id,p_feature_key,p_usage_date)`：利用回数を減算
- 両方ともSECURITY DEFINER、引数にuser_idを持つが、**現時点の実測ではanon/authenticatedにEXECUTE権限なし**。proaclはpostgresとservice_roleのみ。したがって通常の匿名/ログイン済みユーザーがRPCとして直接呼び出せるとは判断しない。
- service_role経由の既存アプリ呼び出しを壊さないよう、関数や権限は変更しない。

## 残る調査
- GitHubの会員登録、LINE連携、決済、退会、プロフィール更新経路の依存をコード上で特定する
- プロフィール列単位UPDATEを縮小した場合の正常系/異常系テスト
- 実JWTとRESTでRLSを検証（DB管理SQLの結果だけでは代替不可）
- 通知API公開、権限修正、本番DB変更はHOLD

**本番DBの更新・GRANT/REVOKE・RPC呼び出しは未実施。**
