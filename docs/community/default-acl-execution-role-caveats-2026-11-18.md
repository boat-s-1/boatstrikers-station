# 既定ACL監査の補足・実行ロール権限（2026-11-18）

## 新たに確認した事実
- publicスキーマの通常テーブルでRLS未有効のものは0件（本番読み取り専用集計）。
- publicスキーマownerはpg_database_owner。bs_member_profilesのownerはpostgres、RLS enabled。
- postgresはsuperuser=false。supabase_adminはsuperuser=true。
- pg_auth_members上、postgresにはanon/authenticated/authenticator/service_role等のmembershipがあるが、supabase_adminへのmembershipは見つからない。
- default ACLはpostgresとsupabase_admin双方のgrantorで登録されている。

## 影響
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_adminを通常のpostgres接続から変更できると決めつけてはならない。postgresはsuperuserではなく、supabase_adminのメンバーシップも確認できなかったため、supabase_admin側ACLの変更は隔離環境/公式管理経路で権限確認できるまでHOLD。SET ROLE等を推測で試さない。
Supabase公式の現行Securing your APIガイドはpostgres roleのdefault privileges変更例を掲載している。まずpostgres側のdefault ACLだけを隔離環境で検証し、supabase_admin由来の新規オブジェクトは作成主体・管理範囲を特定してから扱う。

## 修正案に関する注意
先行文書のSQLは候補案であり、supabase_admin用ALTER DEFAULT PRIVILEGESは実行可能性未確認。両方を一括で本番適用するSQLではない。
publicの全通常テーブルでRLSが有効であることは確認したが、RLSポリシーの品質・view/function exposure・個々のGRANTの適正性まで保証するものではない。

## 状態
読み取り専用調査のみ。本番のACL/DDL/DMLに変更なし。
