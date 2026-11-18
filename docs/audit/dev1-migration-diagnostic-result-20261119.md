# 開発① 隔離Migration診断結果

実施: 2026-11-19 02:35 JST 頃。対象はSupabase project rzosrbkyniyedolhkgxoの新規開発ブランチ dev1-migration-diagnostic-20261119、branch ID 36addc0c-68ef-4202-b3dc-982c21253dbb、preview ref wsqijqnztlcrcozfdotp。with_data=false。今回の利用者承認を得て実施。Supabase get_cost は US$0.01344/時間。実請求額は未確定。

ブランチは CREATING_PROJECT → FUNCTIONS_DEPLOYED → MIGRATIONS_FAILED。分離DBの読み取り専用照合で public.bs_race_events / bs_race_entries / bs_race_results は全て存在しない。list_migrations は 20260819205859 から 20260820194818 まで11件を返した。

2026-11-19 02:35:21.009 JST の postgres_logs で `create or replace function public.ai_v2_public_character_stats` を実行、02:35:21.010 JST に `relation "public.bs_race_results" does not exist`。ログ属性の SQLSTATE は `42P01`、command tag は CREATE FUNCTION。次のMigration `20260820210127` に相当する失敗と判断する。これは今回の新規ブランチの証拠であり、削除済みPR #298の元ブランチのログではない。

診断後にこの新規branch IDだけを delete_branch し success=true を受領。list_branches で対象IDが存在しないことを再確認。既存の開発②ブランチと過去の別ブランチ、本番DB/Cron/Vercelを変更していない。

## 次の依存関係

1. 2026年8月19日以前の初期テーブルDDLの由来を Git履歴・バックアップ・Supabaseサポート SU-557322 で探索する。現在の本番カタログを当時のDDLと同一とみなさない。
2. 由来を確定した初期DDLとMigration全件を分離PostgreSQLで順に再生し、同じ失敗を再現・解消する。
3. 隔離Supabaseに保存候補を設置する実SQL試験と前夜全件の公式照合は別途費用・書込条件を確認する。今回の診断だけでサイト復旧や本番切替を合格とはしない。

## 原本探索の追加確認（2026-11-19 JST）

- GitHub上の回収済み `supabase/migrations_recovered` は2026-08-19以降のMigrationであり、初期の主要レーステーブルのCREATEを含む原本とは確認できない。
- 既存の `CORE-TABLES-REVIEW-DRAFT.sql` と `SIX-TABLE-ISOLATION-CANDIDATE.sql` は現在の本番カタログから後日抽出・組立した候補。後者は6テーブル・トリガー・RLSを含むが、2026年8月の初期状態を証明しない。CIの合格を全Migration再生の証明とは扱わない。
- デフォルトブランチのコード検索で `CREATE TABLE public.bs_race_results` は該当なし。ローカル作業ブランチのファイル検索では直接CREATEは候補・試験フィクスチャ内のみ。別ブランチやGit外バックアップは未否定。
- Supabaseサポート SU-557322 のメール検索では自動受付のみで、初期DDLの出典についての回答は未着。
