# 通知会員情報の実接続準備と確認事項（2026-11-17）

## 追加したサーバーコード
`lib/community/notificationMemberServer.js` はサーバー専用モジュール。渡されたアクセストークンをSupabase Auth `getUser(token)` で検証し、**同じトークン**で `bs_member_profiles` の `user_id,membership_status,withdrawn_at` だけを取得する。取得できない場合はnull。匿名キーを使い、service_roleや管理者権限を利用しない。

## セキュリティ上の前提
- `getUser` の実応答と `bs_member_profiles` のRLSによる本人行限定を実環境で確認する。匿名キーを使うだけではRLS安全性は保証できない。
- Auth本人確認と会員プロフィール取得はできても、課金資格は証明できない。plan、beta_member、is_adminは取得も信用もしない。
- `verifiedByTrustedServer` はこのサーバー関数が生成したオブジェクト内に限り有効。ブラウザJSONから同名フィールドを受け取らない。
- 呼び出し元はAuthorizationヘッダーを厳密に解析し、トークンをログ/エラー応答へ記録しない。ブラウザへservice_roleキーを渡さない。
- `membership_status='active'` および `withdrawn_at IS NULL` の評価は `notificationMembership.mjs` が行う。Authの本人確認だけで通知閲覧を許可しない。
- 会員プロフィールの既存GRANT過剰問題は別途修正・検証が必要。

## 未接続・次の受け入れ基準
- 本モジュールを本番通知APIへ接続していない。実Supabase通信、実JWTを用いた他人行拒否、RLS/権限の統合テストは未実施。
- 実通知テーブル、既読の原子更新API、通知内容の権限再確認、プッシュ購読/解除は未実装。
- 独立した検証環境で、会員A/B/anon、退会、無効トークン、過剰GRANT、既存LINE/Discord回帰を検証してから公開判断。
