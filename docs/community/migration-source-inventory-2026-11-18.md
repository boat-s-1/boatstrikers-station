# Migration source inventory（2026-11-18）

## 確認値
- 本番DB `supabase_migrations.schema_migrations`: 133 applied versions（first 20260819205859 / latest 20261116123313）
- GitHub main `supabase/migrations/` recursive tree: 57 files total（56 .sql + 1 .md）
- GitHub main `supabase/` rootにはmigrations/とproposals/が存在。`config.toml`は確認できなかった。

## 解釈上の注意
- GitHub上のmigration SQLファイル数と本番DBのapplied migration history件数は一致していない。
- これだけでは、DB上の133件のmigration SQL本文が欠落しているか、複数のmigrationが統合済みか、手動DDL/別経路で適用されたかは判定できない。
- Supabase公式Branching docsでは、Branching workflowにPullとMigrate段階があり、Dashboard branchingはmain projectからmigration/schema情報を取得する。MCP create_branchの説明もmain projectの全migrationをfresh branch DBへ適用するとしている。
- したがって前回branchの11件という観測は、作成直後のCREATING_PROJECT段階での途中経過だった可能性が高い。ログなしでmigration failureと断定しない。
- GitHub Integrationが有効で、GitHub migration filesを利用する方式かどうかはSupabase dashboardのProject Settings > Integrations > GitHub Integrationで確認が必要。現時点では接続状態を確認できていない。

## 次回の検証に必要な順番
1. 新branch作成前に料金再見積り・再承認。
2. 作成後はSQL実行せず、branch.statusがCREATING_PROJECTを抜けるまで待つ。
3. Supabase Branches画面のView logsでClone/Pull/Migrate/Deployの各stepを確認。
4. branchのmigration count/versionと本番を比較。
5. `bs_member_profiles`と全public table/RLS状態を比較。
6. もしMigrateが失敗した場合のみログから最初の失敗migrationと原因を特定。GitHub integration経路の場合はmigration source completenessも確認。
7. 全工程が成功するまで、branch DBでACL変更テストをしない。

## Source links
- https://supabase.com/docs/guides/deployment/branching
- https://supabase.com/docs/guides/deployment/branching/github-integration
- https://supabase.com/docs/guides/deployment/branching/troubleshooting
