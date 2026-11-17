# 会員登録トリガーと監査関数の実行権限（2026-11-17）

本番Supabaseに対するSELECTのみの追加調査。

- `public.bs_member_profiles` の直接ACL：postgres/anon/authenticated/service_roleが全テーブル権限。
- `public.bs_member_plan_events` の直接ACL：postgresとservice_roleのみ。一般ロールには直接GRANTなし。
- `public.handle_boatstrikers_member_signup()` と `public.bs_log_member_plan_change()` の関数ACL：postgresとservice_roleにEXECUTE。
- `has_function_privilege` で anon/authenticated にsignup関数のEXECUTE権限なし、anonに監査関数のEXECUTE権限なしを確認。
- 両関数はpostgres所有のSECURITY DEFINER。signupは `auth.users` のINSERTトリガーから呼ばれるため、一般ロールに直接EXECUTEを付与しなくても登録できる設計の可能性がある。ただし**実登録を行っての検証は未実施**。
- 最新のコミュニティ自動テスト run `44099984009` はsuccess。

## 検証上の注意
- テーブル権限を剥奪しても、SECURITY DEFINERトリガーが正常動作することを**隔離環境の実登録**で確認する必要がある。
- アプリ/Edge Functionsの直接プロフィール書き込み、LINE連携、退会、管理操作への影響は未調査。
- 本番DB変更なし、新規有料ブランチなし。PR Draft維持。
