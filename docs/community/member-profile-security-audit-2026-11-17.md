# 会員権限の読み取り専用監査・隔離テスト計画 (2026-11-17)

## 重大な懸念（本番未変更）
本番 `public.bs_member_profiles` について、`authenticated` に `plan`, `membership_status`, `premium_until`, `is_admin`, `beta_member`, `user_id` など全列の UPDATE 権限が付与されていることを `information_schema.column_privileges` で確認した。本人行に対する UPDATE RLS と SELECT RLS も確認済み。

`information_schema.triggers` にある UPDATE トリガーは、プラン変更履歴の記録 `bs_log_member_plan_change` と更新日時 `touch_bs_member_profiles_updated_at` のみ。関数定義の読み取りでは、どちらも一般会員による特権列変更を拒否するロジックが見つからなかった。

**解釈:** 本人の行に対して、通常の認証済み API クライアントから特権列を更新できる可能性が高い。実際の REST API とユーザーセッションでの更新成功は未検証のため、現時点では確定した悪用実績と断言しない。プラン変更履歴トリガーは防止策ではない。

## 隔離テストでの検証条件
- 本番ユーザー情報をコピーせず、隔離環境のテストアカウントのみを使用
- 認証済み一般会員による自分の `is_admin`, `plan`, `premium_until`, `membership_status`, `beta_member`, `user_id` 更新を拒否すること
- 表示名の更新が引き続き成功すること
- 別ユーザーの行は SELECT/UPDATE できないこと
- サーバー側の正規課金処理・管理者処理による特権列変更は維持すること
- 既存 LINE/退会/利用規約/メール更新フローに回帰がないこと
- アクセストークン・秘密鍵・個人情報をログに出さないこと

## 修正案（本番では実行しない）
RLS は「どの行か」を制御するため、本人行の特権列更新防止には **列単位の UPDATE 権限**を使う。まず既存コードが直接更新する一般会員向け列を調べる。次に `authenticated` へのテーブル全列 UPDATE 権限を取り消し、必要な一般列のみ明示的に GRANT UPDATE する。必要に応じてテーブル/列権限とRLSを組み合わせる。

**注意:** 既存の一般会員プロフィール更新処理を調べずに REVOKE を本番実行しない。所有者/継承ロール/関数/トリガー/バックエンドサービスキーの経路も隔離で検証する。

## 掲示板への影響
- `bs_member_profiles.plan` や `is_admin` を信用する有料返信・公式投稿権限は、この問題の隔離検証完了まで実装を公開しない。
- 掲示板の RLS は `auth.uid()` と本人確認済みプロフィールを参照する。プロフィール自体の権限昇格経路が残る限り安全とは判定しない。
- 既存の有料会員判定仕様（plus / premium / beta_premium）と有効期限は既存サービスの契約に合わせる。

## 検証の証拠
Supabase MCP による本番 DB 読み取り専用SQL:
1. `information_schema.column_privileges` の UPDATE 列権限
2. `information_schema.triggers` の bs_member_profiles トリガー一覧
3. `pg_get_functiondef` のトリガー関数定義

## 変更管理
- 本番DBには未適用
- 隔離環境の作成は時間課金が発生し得る。作成時は課金承認フローに従う
- 修正PRと隔離テストが完了し、影響範囲・ロールバック・本番反映の承認を得るまでHOLD
