# AI司令塔：再起動時のDB再実行テスト — 2026-11-17

## 目的
既存の隔離PostgreSQLテストに、**COMMIT後に同じ作業を再実行した場合**の検証を追加する。

## 検証手順
1. `incident_committed_01` を `attempt_original` が確定登録する。
2. 別のattempt IDで同じincident keyを2回登録しようとする（`ON CONFLICT DO NOTHING`）。
3. 行数1件かつ所有attemptが変更されていないことを確認する。
4. 同じincidentに対して通知候補を再登録し、行数が1件であることを確認する。

これはDBの永続的な重複排除の検証であり、アプリの再起動を模擬したリプレイです。実際の通知送信や受信側の冪等性は検証していません。

## 運用境界
GitHub Actionsの一時的なPostgreSQLサービスのみ。スクリプトは `127.0.0.1` / `agent_controller_ci` 以外への接続を拒否する。本番Supabase、Cron、Vercel、通知サービスは変更しない。

## 残課題
配信途中の障害と外部受信確認、監視処理全体の再起動、保存された通知receipt、保持期限、最終セキュリティ審査。本番判定はHOLD。
