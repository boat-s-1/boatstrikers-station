# 隔離ブランチ初期化状況の再評価（2026-11-18）

## 前回報告の修正
前回の隔離ブランチは、作成直後の状態でmigration数・テーブルを照会し、mainより少ないことから「初期化不完全」と判断して削除した。しかし、Supabase公式のBranching資料では、ブランチ作成後にClone → Pull → Health → Configure → Migrate → Seed → Deployの段階を順に実行する。Branch APIの説明にも新規ブランチDBへmain projectのmigrationを適用するとある。
観測時点ではbranch.statusがCREATING_PROJECTのままで、migration工程完了を示す状態ではなかった。preview_project_status=ACTIVE_HEALTHYはDBサービスのヘルス状態であり、branch全体のmigration完了を示すとは限らない。
したがって「同期に失敗した」と断定した前回の表現は強すぎる。正確には、**作成処理完了前に確認してしまい、migration適用中だった可能性を排除できない。原因は未確定**である。削除済みブランチのログは再取得できず、失敗原因の確定はできない。

## 本番側の再確認（読み取り専用）
- supabase_migrations.schema_migrations: 133件
- first_version: 20260819205859
- latest_version: 20261116123313
- public.bs_member_profiles exists
- public通常テーブルでRLS未有効: 0件

## Supabase公式のBranching手順
公式Working with branches / Branching docs:
- https://supabase.com/docs/guides/deployment/branching
- https://supabase.com/docs/guides/deployment/branching/working-with-branches
- https://supabase.com/docs/guides/deployment/branching/troubleshooting

Branching deployment steps:
1. Clone
2. Pull (Dashboard branching may retrieve migrations from main project)
3. Health
4. Configure
5. Migrate
6. Seed
7. Deploy

Migration list and target schema should only be judged after branch deployment workflow reaches completed/successful state. If status remains CREATING_PROJECT, inspect branch deployment logs and wait; do not infer a permanent schema defect from an early snapshot.

## 次回の正しい検証計画
1. 新しいbranchを作成する前に、最新料金を再取得し、ユーザーへ再確認する（前回branchは削除済み。新しいbranchの課金承認は改めて必要）。
2. branch作成直後はSQLを実行しない。list_branchesでstatusを定期確認し、CREATING_PROJECTを抜け、正式な完了状態になるまで待つ。
3. migration count/latest versionが本番133件/latest_version 20261116123313に一致することを確認する。
4. public.bs_member_profilesが存在し、public通常テーブルのRLS状態が本番と一致することを確認する。
5. branch logsが取得可能ならclone/pull/migrate/deploy各段階の結果を保存。
6. 以上が一致してからACL probeとテスト専用オブジェクト検証を行う。
7. supabase_admin default ACLは別途実行権限が確認できるまで触れない。
8. 完了後はbranch削除し、list_branchesで消失確認。

## 安全状態
- 本番DBは読み取り専用確認のみ。DDL/DML/GRANT/REVOKE変更なし。
- 前回branchは削除済み。新規branchは未作成。
- 本番データをbranchへ複製する設定は使わない（with_data=false）。
