# LINE連携コードのテーブル権限監査 — 2026-11-17

## 本番DB読み取り専用結果
- `public.bs_member_line_link_codes` は7列: id, user_id, code, expires_at, used_at, line_user_id, created_at。
- RLS有効。本人のコード閲覧（SELECT `auth.uid()=user_id`）と本人コード作成（INSERT WITH CHECK `auth.uid()=user_id`）のポリシーがある。UPDATE/DELETEポリシーは確認されなかった。
- `anon` と `authenticated` のテーブルACLはいずれも `arwdDxtm`（広範な権限）。
- `has_table_privilege` の実効権限: 両ロールともTRUNCATE=true、DELETE=true、UPDATE=true。
- TRUNCATEはRLSを経由しない。PostgREST Data APIから直接TRUNCATE可能と主張するものではない。実際の外部到達経路は未検証。

## 対応案（未実行）
- `bs_member_profiles` に加えて `bs_member_line_link_codes` のテーブル権限も棚卸し対象とする。
- LINEコードの作成には本人INSERTとSELECTが必要な可能性。使用済み記録（used_at, line_user_id）はサーバー側だけが更新すべきか、LINE連携実装を確認する。
- 最小権限案: anonの全テーブル権限を撤回し、authenticatedは必要なSELECT/INSERTに限定することを候補とする。ただし実アプリ・RLS・シーケンス権限の確認が必要。
- 本番変更なし。外部API・実会員操作未検証。本番適用HOLD。
