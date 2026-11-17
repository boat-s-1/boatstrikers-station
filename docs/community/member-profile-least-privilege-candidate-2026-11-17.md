# プロフィール権限の最小化候補 — レビュー専用（2026-11-17）

## 本番の読み取り専用調査で確認
- `public.bs_member_profiles` owner=`postgres`、直接ACLは `anon=arwdDxtm` / `authenticated=arwdDxtm` / `service_role=arwdDxtm`。両一般ロールは全16列のUPDATE権限あり。
- RLS有効。SELECTとUPDATEはauthenticatedの自己行に限定。ただしUPDATE列制限なし。
- `handle_boatstrikers_member_signup` はpostgres所有、SECURITY DEFINER。プラン変更監査関数もpostgres所有、SECURITY DEFINER。

## 追加確認\n- 本番の `pg_attribute.attacl` に明示的な列単位GRANTは0件。現在の全列UPDATE権限はテーブルGRANTに由来する。\n- プロフィールを直接参照するビューのカタログ依存検索は0件。ただしアプリケーションやEdge Functionsの参照がないことは意味しない。\n- 修正後の権限検証SQLを `docs/community/sql/member-profile-post-remediation-assertions.sql` に追加（読み取り専用、現行本番では不合格になる想定）。\n\n## 隔離環境でのみ適用する候補SQL
以下は**本番実行禁止**。実運用コードの書き込み列を洗い出すまで、`display_name` 以外のUPDATEは意図的に付与しない。匿名ロールのGRANTを撤去し、authenticatedには自己行SELECTと表示名UPDATEだけを付与する。RLS自己行条件は維持。

```sql
BEGIN;
REVOKE ALL PRIVILEGES ON TABLE public.bs_member_profiles FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.bs_member_profiles FROM authenticated;
GRANT SELECT ON TABLE public.bs_member_profiles TO authenticated;
GRANT UPDATE (display_name) ON TABLE public.bs_member_profiles TO authenticated;
-- Run assertions here; COMMIT only in a disposable isolated environment.
ROLLBACK;
```

**注意:** このSQLは意図的にROLLBACKするため本番へコピーして実行しない。実際の隔離検証では権限変更後の認証API、登録、更新、LINE連携、退会、監査ログ、バックエンド操作を別トランザクションで検証する。列単位のGRANT、ロール継承、PUBLIC権限、PostgRESTスキーマキャッシュも再確認。

## 必須の受け入れ条件
1. anon/authenticatedでTRUNCATE/DELETE/INSERT/TRIGGER/REFERENCESの実効権限がfalse。anon UPDATEもfalse。
2. authenticatedで `is_admin` / `plan` / `premium_until` / `membership_status` / `user_id` のUPDATEがfalse。
3. authenticatedの `display_name` UPDATEがtrue、他人行UPDATEはRLS拒否。
4. auth.usersの登録トリガーが新規プロフィールを正常作成。
5. 管理者・課金・LINE・退会・規約同意・監査機能が既存動作を維持（必要なら専用SECURITY DEFINER APIを別途設計）。
6. 実JWT/PostgRESTによる拒否・成功テストとロールバックを完了。
7. 本番変更は別途明示承認を取得。現段階では未実行。
