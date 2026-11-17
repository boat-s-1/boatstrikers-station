# 会員プロフィールの最小権限修正：実スキーマ照合（2026-11-17）

## 本番DBの読み取り専用確認
- `public.bs_member_profiles` は16列。表示名に加え `line_user_id`, `line_linked_at`, `terms_accepted_at`, `privacy_accepted_at`, `withdrawn_at` などを持つ。
- SELECTポリシー `members can read own profile`: `auth.uid() = user_id`。
- UPDATEポリシー `members can update own basic profile`: USINGとWITH CHECKとも `auth.uid() = user_id`。
- BEFORE UPDATEトリガー `touch_bs_member_profiles_updated_at`、AFTER INSERT OR UPDATE OF planトリガー `bs_member_plan_change_log`。
- 先の隔離環境には実会員テーブルが存在せず、模擬ACLのみPASS。実登録や既存アプリ経路は未検証。

## 変更案の注意点
- `GRANT UPDATE(display_name)` のみを残すと、アプリが本人権限でLINE連携・同意・退会を直接UPDATEしている場合に失敗する。
- 逆に `plan`, `is_admin`, `premium_until`, `membership_status`, `beta_member` を本人更新可能にするのは課金・管理権限の自己変更につながりうる。
- `updated_at` はBEFORE UPDATEトリガーが変更するため、クライアントへの列UPDATE付与が必要かどうかは実呼び出しを確認する。
- `user_id`, `email`, `line_user_id`, `line_linked_at`, 同意・退会列の変更経路をアプリ・Edge Functions・外部連携で特定し、サーバー専用経路と本人編集可能列を区別する。
- 修正案は本番適用不可（HOLD）。実スキーマと認証を再現した隔離環境でAPI回帰試験を行うまで、権限剥奪の適用範囲を確定しない。

## ブランチ再現の課題
- 本番のmigration履歴は133件。会員テーブル関連履歴 `20260825115731 create_boatstrikers_member_profiles`, `20260825120846 add_member_consent_and_withdrawal_fields`, `20260825121939 add_member_line_link_codes`, `20260914192918 add_member_admin_flag` が存在する。
- しかし新規Supabase開発ブランチに `bs_member_profiles` がなかった。migration履歴と実DBスキーマの乖離またはブランチへのmigration適用不全の可能性。原因未確定。
- 新たな課金ブランチは作成しない。本番DB変更なし。
