# 追加監査：会員権限・既定ACL・管理経路（2026-11-18）

対象：本番Supabase project rzosrbkyniyedolhkgxoの読み取り専用SQL、およびGitHub mainのコード。行データ・秘密値は取得していない。

## 1. 本番bs_member_profilesの実テーブル権限
information_schema.table_privilegesでanonとauthenticatedに以下すべてが付与されていることを確認：
DELETE / INSERT / REFERENCES / SELECT / TRIGGER / TRUNCATE / UPDATE。
authenticatedには本人行のSELECTポリシーとUPDATEポリシー（auth.uid()=user_id）が存在。anonにはこのテーブルのRLSポリシーが確認できない。
RLSが有効であれば通常APIからの行アクセスはポリシーに制限されるが、過剰ACLは不要であり最小権限化対象。列UPDATE ACLも全16列に付与済み。

## 2. 重要：public schemaのdefault privileges
pg_default_aclに、grantor postgresおよびsupabase_adminのpublicスキーマ新規テーブル（objtype r）に対する既定ACLが確認された。両方ともanon/authenticated/service_roleへ arwdDxtm（ALL TABLE PRIVILEGES相当）を付与する設定。
さらに新規関数（objtype f）へanon/authenticated/service_roleにEXECUTE（X）、新規シーケンス（objtype S）へrwUを付与する既定ACLも存在。
これはbs_member_profiles単体の修正だけでは再発防止にならない。新規オブジェクトを作るロールごとに既定ACLを見直し、必要なものだけ明示GRANTする方針が必要。既存テーブル・関数の権限を一括変更する前に依存関係の棚卸しを行う。

## 3. 会員テーブルの制約・トリガー
- user_idはauth.users(id)へのON DELETE CASCADE。Auth user削除時にプロフィールもDBカスケード削除される定義を確認。
- plan CHECK: free/beta_premium/plus/premium
- membership_status CHECK: active/inactive/cancelled/expired
- AFTER INSERT/UPDATEのbs_member_plan_change_log、BEFORE UPDATEのtouch_bs_member_profiles_updated_atが存在。

## 4. 管理者/決済/定期処理のコード確認
- app/admin/members/page.jsは会員一覧・分析・Discord対象者の読み取り画面。今回読んだページ範囲にプロフィール更新フォームはない。管理者認証は環境変数パスワード署名cookie。
- app/api/admin/discord-members/route.jsはプロフィールを読み取り、Discord一覧と照合するGET。
- app/api/cron/discord-membership-sync/route.jsはプロフィールのplan/statusを読み、Discordロールとbs_member_discord_linksを更新。プロフィール自体は更新しない。
- mainツリーで app/api 配下の会員・payment・billing・checkout・subscription・stripe名の経路を確認したが、決済Webhook/checkout routeは見つからなかった。ただし外部決済/運用ツールや別リポジトリを含む網羅的不存在の証明ではない。
- supabase/migrations/20260915_add_member_admin_flag.sqlは、line_user_idが存在するプロフィールにis_admin=trueを設定するUPDATEを含む。これは過去の一度きりのmigrationであり、現在の一般ユーザー向け更新APIではない。既存管理者判定の意図を確認せず変更しない。

## 5. 安全な是正の方向
- まずdefault privilegesを作成ロール別に最小化するmigration案を隔離環境で検証。postgres/supabase_admin両方のACLを扱う必要がある。
- bs_member_profilesはanon/authenticatedの不要なDELETE/INSERT/REFERENCES/TRIGGER/TRUNCATE/UPDATEを撤去し、SELECTはauthenticated本人行の必要性を維持。一般会員のUPDATEを完全禁止するか、display_name等の必要列のみ許可するかを画面・コード全体で確認する。
- SECURITY DEFINER signup triggerとservice_roleのLINE連携は維持し、A/B/anonの実JWT RESTテストで本人行・他人行・保護列の拒否を検証。
- 既存全テーブル/全関数に対する一括REVOKEは行わない。個別影響をテストして段階的に実施。

## 状態
本番DBへのGRANT/REVOKE/DDL/DMLは一切未実施。PRはDraft。CIは別記コミット69eb1fcで3 checks success。
