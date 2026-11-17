# 会員プロフィール特権列の権限是正案（レビュー専用・未実行）

2026-11-17 に本番DBへ読み取り専用SQLを実施した結果、`public.bs_member_profiles` の `authenticated` ロールには、`is_admin` / `plan` / `membership_status` / `premium_until` / `beta_member` / `user_id` について UPDATE 権限があることを再確認した。UPDATE RLS は `auth.uid() = user_id` の自己行制限のみ。これは**自己行の特権列変更を阻止しない**。実際の認証済みHTTPリクエストによる権限昇格は未実証。

## 追加の読み取り専用検証\n\n2026-11-17に `has_column_privilege('authenticated', 'public.bs_member_profiles', column_name, 'UPDATE')` および INSERT で全16列を照合した結果、**16列すべてで UPDATE=true / INSERT=true**。特権列だけでなく `created_at`、`withdrawn_at`、`line_linked_at` 等も実効権限あり。これは列単位の実効GRANTであり、認証済みHTTP APIでの攻撃成功を直接実証したものではない。\n\n## 提案する安全な是正方針

- `authenticated` のテーブル全体 UPDATE 権限を取り消し、ユーザーが編集してよい列にのみ列単位 UPDATE を付与する。
- `user_id`、`is_admin`、`plan`、`membership_status`、`premium_until`、`beta_member` は自己編集を禁止する。
- INSERT権限も特権列を指定できないよう、プロフィール生成の実経路（トリガー/サーバー）を確認したうえで見直す。
- 既存RLSを保持し、列権限とRLSの**両方**で保護する。
- 既存アプリが更新する正確な列と依存するDB関数・Edge Functionsを調査してから変更する。
- **本番に直接適用しない**。隔離DBで通常会員の更新成功、特権列更新403、管理者更新の維持を検証する。

## 隔離環境でのみ検討するSQLテンプレート（実行禁止）

```sql
-- 先にアプリのプロフィール編集対象列を確定する。
-- 以下の <verified_editable_columns> はプレースホルダーであり、そのまま実行できない。
begin;
revoke update on table public.bs_member_profiles from authenticated;
-- grant update (<verified_editable_columns>) on table public.bs_member_profiles to authenticated;
-- 既存の INSERT 経路・列権限は別途精査する。
rollback;
```

注意：テーブル単位権限を取り消しても、既存の**列単位GRANT**が残っていると特権列を更新できる可能性がある。隔離環境で `information_schema.column_privileges` と `has_column_privilege('authenticated', 'public.bs_member_profiles', '<column>', 'UPDATE')` を用いて実効権限を確認すること。適用後は自動生成API・会員マイページ・管理者編集・課金Webhookの回帰試験が必要。

## 掲示板の公開ゲート

1. 特権列が通常会員から書き換え不能であることを隔離DBの実APIで証明する
2. 有料権限は署名検証済みセッション＋改ざん不能な課金状態・有効期限からサーバー側で判断する
3. RLSとAPIの両方で public / members / paid の3段階を検証する
4. 管理者ロールは課金ロールと分離し、公式投稿APIの認証を独立検証する
5. 公開範囲を変更した際にOG・RSS・検索・キャッシュから漏れないことを検証する

現状：レビュー案のみ。ユーザー承認なしの本番DB変更は行わない。
