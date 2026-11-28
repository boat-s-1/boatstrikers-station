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

## 別ブランチの初期DDL探索（2026-11-19 JST）

GitHubのブランチ名を schema / baseline / migration / bootstrap / initial / supabase で探索。該当した `chore/phase1-supabase-readonly-check`（migrations 32件）、`fix/bootstrap-reconcile-result-provenance`（46件）、`codex/migration-recovery-audit-20261118`（57件）の各 `supabase/migrations` を読み取り、いずれも最早ファイルが `20260821_ai_v2_public_character_stats.sql`。名前に initial / baseline / core / race_results / schema を含むMigrationも見つからなかった。従って確認した3ブランチのMigrationディレクトリからは2026-08-19以前の初期DDLを回収できない。別形式のファイルや調査していないブランチの可能性は残る。

## Supabaseダッシュボードのバックアップ確認（2026-11-19 JST）

認証済みの本番プロジェクト `rzosrbkyniyedolhkgxo` の Database Backups を読み取りのみで確認。Scheduled backups には 2026-11-11 18:20:55 UTCから11-17 18:20:53 UTCまでの物理バックアップ7件が表示された。2026-08-19以前のバックアップはこの一覧にはない。Point in Timeページは「Point in Time Recovery is available as an add-on / Enable the add-on」と表示され、現在有効ではない。復元、アドオン有効化、ダウンロード、本番変更は未実施。このUI範囲では歴史的初期DDLを回収できない。Supabase側の非表示の保存資料やサポート側の記録は未否定。

## サポートアカウント紐付け（2026-11-19 JST）

利用者の今回の承認を受け、Supabaseダッシュボードのチケット紐付け画面で conversation `cnv_1p24sbby` / SU-557322 を組織 boat-strike、project `rzosrbkyniyedolhkgxo`、区分 Other に紐付けた。画面に「Support ticket linked / Your support conversation has been linked to your account.」および成功通知を確認。追加の「Allow support access to your project (Human support and AI diagnostic access)」は既定でONだったが、紐付け前にOFFにして確認した。診断アクセスの拡大は承認対象に含めず実施していない。メール検索時点では人手の新しい回答は未着。実DB/本番Cron/Vercelは変更なし。

## Supabaseサポートへの追送（2026-11-19 JST）

今回の利用者承認に基づき、既存チケット SU-557322 のメールスレッドに、今回確定した `20260820210127` / `42P01` と初期スキーマの復元方法の質問を返信。Gmail送信ID `1a1efcf29d1e935d`、thread `1a1ec4e7d9794537`、SENTを再読で確認。送信文は `docs/audit/dev1-supabase-support-followup-draft-20261119.md` に対応。プロジェクト診断アクセスはOFFのままで、必要な場合は範囲の説明を先に依頼した。本番変更・新規課金なし。回答待ち。
