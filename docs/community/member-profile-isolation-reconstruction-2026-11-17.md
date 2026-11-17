# 既存会員プロフィール隔離再現・追加調査（2026-11-17）

## 確認できた事実
- 本番 `public.bs_member_profiles` は16列。主キー相当の `user_id uuid not null`、`plan text not null default 'beta_premium'`、`membership_status text not null default 'active'`、`beta_member boolean not null default true`、`beta_started_at timestamptz not null default now()`、`is_admin boolean not null default false` 等を持つ。
- `authenticated` の全16列に INSERT/UPDATE の実効権限がある（読み取り専用SQL）。
- UPDATE RLS は `auth.uid() = user_id`。他人の行を変更できない条件であっても、自己行の特権列変更を阻止しない。
- 隔離開発ブランチには同テーブルが存在しなかった。これは本番に存在しないという意味ではない。
- 本番 `supabase_migrations.schema_migrations` は133件。**どのマイグレーションがこのテーブルを作成したかは未確定**。

## 追加確認済みの制約・トリガー\n- PK: `user_id`、FK: `auth.users(id) ON DELETE CASCADE`。\n- `plan` は `free / beta_premium / plus / premium`、`membership_status` は `active / inactive / cancelled / expired` のCHECK制約。\n- `bs_member_plan_change_log` は INSERTまたはplan更新後に監査関数を実行するトリガー。`touch_bs_member_profiles_updated_at` はUPDATE前に更新日時関数を実行するトリガー。これらは特権列の自己変更を防ぐ保証にはならない。\n\n## 再現前の調査手順（すべて読み取り）
1. `pg_constraint` でPK/FK/CHECK/UNIQUE、`pg_indexes` でインデックスを取得。
2. `pg_trigger` と `pg_get_triggerdef` で監査/更新/会員生成トリガーを確認。
3. `pg_policies` と `pg_class.relrowsecurity` でRLSの完全な状態を確認。
4. `pg_roles` / `information_schema.role_table_grants` / `information_schema.column_privileges` で権限継承を調査。
5. GitHub・Edge Functions・Webアプリの会員プロフィール更新経路を列挙し、正規の更新列を確定。
6. 実ユーザー行はコピーせず、隔離DBに**同等の最小スキーマと合成データ**を再現する。
7. 正規会員JWTと隔離PostgREST APIで拒否応答を確認する。SQL `SET ROLE` は補助検証に限る。

## 設計上の追加リスク
`plan` の初期値が `beta_premium`、`beta_member` が true、`membership_status` が active のため、**これらの文字列・フラグだけで有料会員と判定してはならない**。サーバーが信頼できる課金状態、有効期限、テスト会員の付与規則を別途確定する必要がある。

## 実施条件
隔離ブランチは前回削除済み。再作成は別途コスト確認が必要。今回の文書は読み取り専用調査に基づき、DB変更を伴わない。
