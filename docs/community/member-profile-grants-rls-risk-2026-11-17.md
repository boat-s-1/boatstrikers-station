# 会員プロフィールのRLS・GRANT実態と是正前ゲート（2026-11-17）

## 本番読み取り専用SQLで確定
- `public.bs_member_profiles` のRLSポリシーは2件だけ：authenticated SELECT `auth.uid()=user_id`、authenticated UPDATE `USING auth.uid()=user_id WITH CHECK auth.uid()=user_id`。INSERT/DELETEポリシーは確認できなかった。
- `information_schema.role_table_grants` では **anon と authenticated の両方に SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER** のテーブルGRANTが列挙された。
- `pg_class` で `relrowsecurity=true`、`relforcerowsecurity=false`。anon/authenticatedの `rolbypassrls=false` を確認。\n- `has_table_privilege('anon',..., 'TRUNCATE')` と `has_table_privilege('authenticated',..., 'TRUNCATE')` が**両方true**であることを直接確認。\n- RLSが有効な場合、通常のINSERT/DELETEは適合するポリシーがなければ拒否される。ただし **TRUNCATEはRLSの対象外**。テーブルGRANTが実効的なら、公開API以外の経路を含めて危険性がある。PostgREST経由で実行可能と断定はしない。
- UPDATEは自己行RLSだけで、`plan`、`is_admin`、`premium_until` 等の列を制限していない。
- 既存の新規会員作成は `auth.users` の AFTER INSERT → SECURITY DEFINER `handle_boatstrikers_member_signup()`。この経路を壊さないことが必須。

## 是正候補（未実行、最終SQLではない）
1. `anon` の全テーブルGRANT、`authenticated` の INSERT/DELETE/TRUNCATE/TRIGGER/REFERENCES と全列UPDATEを取り消す。ただし継承・PUBLIC・列単位GRANTの残存を調査する。
2. `authenticated` のSELECTは既存RLSに従い維持し、UPDATEは検証済みの表示名など必要最小限の列に限定する。
3. 新規登録のSECURITY DEFINER所有者権限、プラン監査トリガー、規約同意の正規更新、LINE/Discord連携、退会・管理者処理を隔離DBで回帰検証する。
4. `has_table_privilege` と `has_column_privilege` に加え、`SET ROLE` と認証済みHTTP/JWTの両方で拒否を証明する。
5. 本番適用前に、復旧SQL・ロールバック手順・影響一覧・監視方法をレビューする。

## 禁止事項
この文書は調査結果と安全ゲートの記録。**本番SQL実行、権限変更、課金機能の開放は承認前に行わない。**
