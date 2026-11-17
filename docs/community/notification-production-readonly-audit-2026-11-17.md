# 通知API導入前の本番DB読み取り監査（2026-11-17）

## 調査方法
Supabase production project `rzosrbkyniyedolhkgxo` に対して、pg_catalog、information_schema、pg_policiesを**SELECTのみ**で確認。データ行、秘密値、メールアドレス、トークンは取得しない。

## 実測
- `public.bs_member_profiles` 存在、RLS enabled、FORCE RLS disabled
- `anon` SELECT ACLあり（RLSのauthenticated限定SELECT policyにより匿名アクセスは許可されない想定。ただし実JWT/REST検証未実施）
- `authenticated` SELECT/UPDATE/DELETE ACLあり
- SELECT policy `members can read own profile`：`auth.uid() = user_id`
- UPDATE policy `members can update own basic profile`：USING/WITH CHECKともに `auth.uid() = user_id`
- 列：`user_id,email,display_name,plan,membership_status,beta_member,beta_started_at,premium_until,line_user_id,line_linked_at,created_at,updated_at,terms_accepted_at,privacy_accepted_at,withdrawn_at,is_admin`
- `bs_notifications`, `bs_notification_preferences`, `bs_push_subscriptions`, `bs_notification_deliveries`, `community_threads` はpublicスキーマの照会で該当テーブルなし

## セキュリティ評価
- 行単位の本人UPDATE制限は**列単位の権限保護ではない**。現在のテーブルUPDATE ACLと組み合わせると、`plan`, `membership_status`, `beta_member`, `premium_until`, `is_admin` などを本人が変更できる可能性がある。実APIでの悪用可能性は未検証。
- 会員のactive状態をプロフィールから読む通知認証確認APIも、現状の権限構成のまま本番公開する前にプロフィール列の更新権限を是正する必要がある。
- 通知用DBテーブルが存在しないため、通知一覧/既読/Pushの実接続は不可。

## HOLD・次の検証
1. 会員プロフィールの更新経路・DBトリガー・アプリ依存を確認してから、権限を最小化する変更案をレビュー
2. 隔離環境で認証済み会員A/B、匿名、退会済みのSELECT/UPDATE/DELETE、列単位更新拒否を実JWT/RESTで検証
3. 通知テーブルを隔離環境に作り、RLS/原子的既読更新を検証
4. 本番DB修正、追加料金が発生する検証環境作成、PRマージ、デプロイは別途承認後

**この監査で本番DBは一切変更していない。**
