# 隔離ブランチ権限検証結果 — 2026-11-17

## 対象と費用
- ユーザー承認済み、単価US$0.01344/hour（2時間想定US$0.02688、追加使用量別）。
- 新規branch: `community-profile-privilege-isolation-20261117`、project_ref `gocrcjkejejqqdcjecog`。
- **検証終了後にdelete_branch成功、list_branchesで消失確認済み**。

## 実際に行った検証
1. 隔離ブランチの `to_regclass('public.bs_member_profiles')` はNULL。したがって実テーブル・実会員登録トリガーの回帰試験は不可能。
2. 代わりに `BEGIN ... CREATE TABLE public.community_privilege_fixture ... GRANT ALL ... REVOKE ALL ... GRANT SELECT ... GRANT UPDATE(display_name) ... SELECT has_*_privilege ... ROLLBACK` を実行。
3. 検査結果: anon TRUNCATE=false、authenticated TRUNCATE=false、authenticated display_name UPDATE=true、authenticated is_admin UPDATE=false。
4. ROLLBACK後のfixtureテーブルは存在しないことを確認。
5. 本番DBは一切変更していない。PR #294の既存ブランチも変更していない。

## 判定
- **PASS（限定）**: PostgreSQLのテーブルACLを全剥奪して必要な列UPDATEだけ戻すSQLの権限効果は、隔離の模擬テーブルで確認できた。
- **NOT TESTED**: 実 `bs_member_profiles` の権限変更、実JWT/PostgREST、signupトリガー、LINE連携、退会、管理操作、RLSと実アプリの統合。
- 本番適用はHOLD。実テーブルがブランチに再現される方法を調査し、上記の実動作検証が必要。
