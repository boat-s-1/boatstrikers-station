# 通知受信箱：隔離検証チェックリスト（2026-11-17）

## 今回の成果
`docs/community/sql/notification-inbox-rollback-fixture.sql` は **BEGIN/ROLLBACK限定のSQL草案**。本番DBにも隔離DBにも未実行。既存の同名fixtureがない専用の検証DBでのみ使用し、成功・失敗どちらでもテーブルを永続化しない想定。実行にはSQL実行者のDDL権限が必要。

## 検証時に確認すること
1. fixture作成とRLS有効化。anon SELECT拒否、authenticated SELECT許可、authenticated INSERT/UPDATE/DELETE/TRUNCATE拒否を実測。
2. authenticatedユーザーAで本人の通知のみSELECT可能、Bの通知は不可、anonは不可。RLS検証には**実JWT相当のauth.uid()**が必要で、postgresロールのSELECTだけでは証明にならない。
3. 通知の作成・既読は信頼済みサーバーAPIだけで実行。セッション本人をDB対象に照合し、任意のrecipient_user_idやauthorized_by_serverをクライアントから信用しない。
4. `UNIQUE(recipient_user_id,dedupe_key)` による二重作成の拒否と同時実行時の挙動。
5. 公開停止/会員資格失効後に、既存通知のタイトル・概要・リンクが漏れない。SQLのRLS本人判定だけでは投稿の現在の閲覧権限は保証されないため、API側で再検証。
6. 退会・プッシュ解除・端末変更・通知設定OFF時に配信されない。
7. rollback後にfixtureが存在しないことを確認。失敗時はトランザクション状態を調べ、残存物を推測で削除しない。
8. 本番に既存のLINE/Discord送信がある場合、変更前後で配信件数・送信先・重複・失敗率を比較。

## ブロッカー
- 実際のログイン/課金正本・API経路・既存通知送信元・会員プロフィールの過剰GRANT未解決。
- 本番へのDDL、PRマージ/デプロイ、新規課金隔離環境の作成は未承認。
- 現時点のSQLは**正式migrationではない**。実環境でテスト後、必要なmigration生成とレビューが必要。
