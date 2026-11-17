# 会員権限是正：依存関数の追加監査（2026-11-17）

本番Supabaseに対し**SELECTのみ**実施。

- `pg_proc.prosrc ILIKE '%bs_member_profiles%'` をpublic/authスキーマで検索したところ、明示的にテーブル名を含む関数は `public.handle_boatstrikers_member_signup` のみ。**動的SQL、ビュー、Edge Functions、アプリケーションコード、他スキーマの依存はこの検索で除外できない。**
- `handle_boatstrikers_member_signup` と `bs_log_member_plan_change` はともに `postgres` 所有、SECURITY DEFINER、関数設定 `search_path=public`。
- `search_path=public` の安全性はスキーマのCREATE権限、関数内の非修飾識別子、呼び出し経路を合わせて評価する必要がある。現時点で安全と断定しない。
- 会員テーブルはRLS有効で、anon/authenticatedのTRUNCATE実効権限true。PostgREST経由のTRUNCATE可否は未検証。

## 隔離検証前に追加で必要
1. `public` スキーマへのCREATE権限（PUBLIC/anon/authenticated）と関数定義中の非修飾オブジェクトを確認
2. Web/Edge Functions/LINE連携/退会処理がプロフィールへ直接UPDATEしていないかコード検索
3. 課金の正本を特定するまで、プロフィールの `plan` / `beta_member` / `premium_until` を特権根拠にしない
4. 隔離環境で通常登録、表示名更新、管理更新、連携、拒否ケースを検証してから権限変更を検討

本番変更なし。隔離ブランチ新規作成なし。
