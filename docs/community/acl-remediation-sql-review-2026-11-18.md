# 権限是正のSQL案・実行前レビュー（2026-11-18）

## 判定
本番適用不可（HOLD）。本書は実行手順案であり、migrationとして適用していない。Supabase公式「Securing your API」では、GRANTがData APIでオブジェクトに触れる権限、RLSが行アクセスを制御する層と説明され、publicの新規テーブル/関数に自動GRANTが付く既存プロジェクトがあるため、明示的最小権限を推奨している。

## A. 今後作成されるオブジェクトの既定ACL案
本番で確認したdefault ACLはgrantor postgresとsupabase_adminの両方に存在する。各作成ロールについて次を検証候補とする。

~~~sql
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE USAGE, SELECT ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE USAGE, SELECT ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
~~~

**重要な注意**
- ALTER DEFAULT PRIVILEGESは対象オブジェクトを作るロールごとに適用される。postgres/supabase_adminの両方について、実行ロールが変更権限を持つか隔離環境で確認する。supabase_adminの権限を変更できない場合は停止し、無理にロール切替しない。
- この案はanon/authenticatedの自動付与を抑止し、service_roleの既存自動付与は残す設計。新規オブジェクトは原則RLS有効化し、service_role以外は必要な権限だけmigrationで明示GRANTする。
- default ACLの変更は将来作成分のみ。既存テーブル/関数の権限は別工程。
- 既定ACL変更後に作られる新規関数はPUBLIC EXECUTEも撤去されるため、意図した公開RPCは個別にGRANT EXECUTEする。

## B. bs_member_profiles既存ACL是正案（別migration候補）
テーブル/列権限の両方を棚卸ししてから実施する。テーブル単位REVOKEだけでは列単位UPDATE ACLが残る場合があるため、列UPDATEも明示的に撤去する。

~~~sql
REVOKE ALL PRIVILEGES ON TABLE public.bs_member_profiles FROM anon, authenticated;
REVOKE UPDATE (
  user_id, email, display_name, plan, membership_status, beta_member,
  beta_started_at, premium_until, line_user_id, line_linked_at,
  created_at, updated_at, terms_accepted_at, privacy_accepted_at,
  withdrawn_at, is_admin
) ON TABLE public.bs_member_profiles FROM anon, authenticated;

GRANT SELECT ON TABLE public.bs_member_profiles TO authenticated;
~~~

- RLS本人SELECTポリシーは維持。UPDATE policyは、UPDATE ACLがなくなればAPIから使用されなくなるが、隔離テスト後に削除するか判断。
- anonは現在RLSポリシーが見つからないが、テーブルACL自体を撤去する。
- service_roleの既存権限はこの案で変更しない。
- 既存画面に一般会員プロフィール編集機能が存在しないか全コード確認が必要。今回調査した会員APIでは見当たらないが、全repo/外部運用の網羅性は未確定。

## C. 実行前に必須の確認
1. default ACLの全 grantor・全 schema・全 object typeを再取得し、public以外への波及がないことを確認。
2. role membershipと has_schema_privilege / has_database_privilege を調べ、postgresからsupabase_adminのdefault ACL変更が可能か確認。
3. default privilegesの変更前後にテスト用のtable/function/sequenceを作成し、anon/authenticated/service_role/PUBLICの権限を比較。テストオブジェクトは隔離DBのみ。
4. bs_member_profilesのtable ACL・全column ACL・RLS・view dependency・trigger・function dependencyを保存。
5. A/B/anon実JWTでGET own/other、PATCH protected columns、INSERT/DELETE/TRUNCATEを試し、拒否を確認。service_roleのLINE webhook更新とsignup triggerを確認。
6. 退会(Auth delete cascade)、Discord membership cron、entitlement、feature usage、管理者読み取りを回帰テスト。
7. rollback SQLを事前作成。default ACLを元に戻す場合も、既存の個別ACLを上書きしないよう変更前の正確なACL差分を使う。

## D. 変更してはいけないもの
- 既存全テーブル/全関数への一括REVOKE
- service_roleの既存権限
- Auth signup SECURITY DEFINER trigger
- LINE webhookのservice_role更新
- Discord cronと会員判定
- 本番のis_admin値・会員プラン値

## E. 検証・リリースゲート
- 隔離DBで全テスト成功、差分レビュー、rollback確認後に本番用migrationを確定。
- 本番適用は別途明示承認を得る。現時点ではSQLを一切実行しない。

## 公式根拠
Supabase Docs: https://supabase.com/docs/guides/api/securing-your-api
要点：GRANTとRLSは別レイヤー。既存プロジェクトではpublic新規テーブル/関数へanon/authenticated/service_roleの自動権限が付くことがある。最小権限の明示GRANTとRLSを組み合わせる。
