# BoatStrikers AI司令塔 — PR #299 統合監査・承認境界 (2026-11-17)

## 監査対象と現状

- Draft PR #299, branch `codex/agent-controller-offline-v24-20261117`, base `bfe285759b8f819669e920875495c642039b21a0`.
- 監査時点の差分: **184 files, +3,609 lines, 0 deletions**。これは運用準備完了を意味しない。差分が大きいため、リリース前に用途別PR分割または独立レビューが必要。
- 最新確認済みCI: offline smoke run `44080096918` SUCCESS、isolated PostgreSQL race run `44080096982` SUCCESS (head `3d611d5393ae871b5fe195aabecd08070d5ef9e8`)。
- 実装済みの大部分は純粋関数、固定模擬データ、GitHub Actionsの使い捨てPostgreSQLである。本番監視・自動修復・外部通知は稼働していない。

## 確認済み（限定的）

1. GitHub ActionsでNodeオフラインテストと使い捨てPostgreSQL 17の一連のテストが成功。
2. 競合ユニーク制約、クラッシュ時ロールバック、リース・フェンシング、予約＋outbox原子性、模擬receipt、DB状態遷移ガードを隔離環境で検証。
3. 監視snapshot入力検査 → 異常候補 → outbox状態遷移提案の純粋関数を統合し、6件の固定模擬ケースの判定結果をActions artifactに保存。
4. 以前、ユーザー承認済みの有料Supabase隔離ブランチでDDL/RLSの限定検証を実施し、ブランチ削除済み。**再作成には別途費用承認が必要**。

## 未検証・リリース阻害条件（優先順）

| 優先 | ブロッカー | 必要な証跡 | 現状 |
| --- | --- | --- | --- |
| P0 | 実際の監視元の認証・読み取り専用取得 | credential scope / RLS / SQL fingerprint / source provenance | 未接続。caller-provided `readonlyVerified` は証明ではない |
| P0 | 本番とは隔離された実アプリワーカーとDB保存の接続 | 同一トランザクション予約/outbox、CAS、リース喪失後の安全停止 | DB-only/純粋関数のみ |
| P0 | 通知承認者と配信receiptの真正性 | サーバー側認証、provider-side idempotency、配信結果照合 | 模擬booleanと模擬receiptのみ |
| P0 | `delivery_unknown` の運用 | 自動再送禁止、手動照合、二重送信防止 | モデルのみ |
| P0 | 実際の監視対象・異常判定の仕様 | Cron schedule, timezone, attempt ID, late arrival, partial status, news correlation, alert threshold | 仕様未確定。単純な「partial/unfinished」は通知の根拠にならない |
| P1 | 本番と同等のスキーマ・権限・性能 | migration dry run、RLS、index、query plan、負荷、ロールバック | 一部隔離検証のみ |
| P1 | 独立したセキュリティ・運用レビュー | 権限最小化、秘密情報、監査、復旧、停止スイッチ | 未実施 |
| P1 | PRのレビュー可能な単位への分割 | read-only monitoring / DB & outbox / delivery integration / docs | 未実施 |
| P0 | 本番デプロイ・外部通知の明示承認 | 操作者の個別承認とリリース手順 | **未承認・禁止** |

## 推奨する実装順序（費用・本番変更なしで可能）

1. **監視元契約の確定**: 既存Cronテーブル/ログの読み取り専用SQLを静的に定義し、各列の型・時刻の意味・遅延許容・欠損時の扱いを明記する。現在の `snapshot` のcallerフラグは実証と混同しない。
2. **隔離ワーカーの最小実装**: Node worker + PostgreSQL adapterをローカルCI PostgreSQLにのみ接続し、実トランザクション、CAS、lease fencing、crash replayを通す。実通知はfake providerのみ。
3. **承認/receiptインターフェース**: 未認証フラグではなく署名・認証済み主体と受領証跡を受ける境界を設計。実provider接続は別承認。
4. **レビュー可能なPRへ整理**: PR #299を安全に維持し、最小機能単位に整理。マージはしない。
5. **独立レビュー→明示承認**の後、段階的に実データ読み取り・通知サンドボックス・本番投入を判定する。

## 明確な禁止事項

本番SupabaseのDDL/DML、Cron変更、Vercelデプロイ、TRINITY変更、外部通知送信、PRマージ、追加有料Supabaseブランチ作成は、個別承認なしに行わない。

**結論: HOLD。** CI成功は隔離テストの成功であり、実運用可能性や配信安全性の証明ではない。
