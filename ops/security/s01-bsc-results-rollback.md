# S01 本番適用済み・検証記録と復旧条件（2026-11-16）

## 実施状況
- 対象：BoatStrikers 本番 Supabase `rzosrbkyniyedolhkgxo` の `public.bsc_results`。
- ユーザーの明示承認後、現在のACL・4件のpolicy・同期関数の所有者/権限/定義hashをガードで照合し、限定的な権限変更を実施。Supabase migration API は success=true を返した。
- 変更内容：`anon` と `authenticated` の INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN をREVOKEし、`public_insert`/`public_update`/`public_delete` の3ポリシーを削除。`public_select` は維持。
- 変更後の独立した読み取り専用SQLで、一般2ロールの SELECT=true、書き込み=false、`service_role` の SELECT/INSERT/UPDATE/DELETE=true、policyはSELECTの1件のみを確認。
- `bsc_sync_official_results_to_legacy` の定義hash `0038e11e13ae845b10a339f03ad236e8` は変更前後一致、`service_role` のEXECUTEは維持。
- 変更前にSupabase日次物理バックアップのCOMPLETED表示を確認。復元テストは未実施（別プロジェクト復元は追加月額見積もり $15.33）。
- 変更前のcatalogから緊急復旧SQLを生成して会話内の成果物として保存。**復旧SQLは危険な一般書き込み権限を再開するため、別承認なしに実行しない**。
- HTTP API経由の権限拒否、実際の正規同期の成功、Storage/Edge Functionsを含む復元は未検証。これらをPASSと記録しない。
- S02の本番公開、PR #297のマージ、Cron・Vercel変更は未実施。

## 適用前に設計した安全条件（履歴）

対象はbsc_resultsのACLと3件の無条件write policyだけ。行・schema・関数・sequenceを変更しない。
管理API POST/PATCH/DELETEはgetAdminScheduleSupabaseのservice_roleを利用。同期SECURITY DEFINERはpostgres所有、service_role限定を事前に再確認する。

当初は本番バックアップと復元可能性が未確認のためHOLDとしていた。後に日次バックアップのCOMPLETEDを確認したうえで、復元テスト未実施の残余リスクを明示し、ユーザー承認後に限定修正を実施した。元のapply.sqlはレビュー用候補であり、実際の適用はcatalog値を固定したガード付きmigrationを使用した。
readonly-check.sqlでACL/列ACL/全policy/関数定義hashを採取し、正確なmanifestをレビューする。
policy manifestはpolicyname順のJSON配列。権限不足・列ACL・継承権限・想定外policy・関数driftは停止する。
applyはpsql変数なしで実行できない。backup=yesだけでバックアップが証明されるわけではなく、実際の証跡照合を必須とする。

通常復旧：正当なwriterが止まった場合はservice_role利用を確認し、一般roleの無条件writeを戻さない。
transaction中のエラーはROLLBACK。本番適用後の緊急復旧は別承認し、保存済みcatalogのGRANT/CREATE POLICYを正確に復元する。
未確認のpolicy名・role・grant optionを推測する固定rollback SQLは作らない。適用前にcatalogから作ったrollback SQLをレビュー・保管するまでHOLD。
既存値を再grantする復旧は脆弱性を再開するため通常手順にしない。

再構築時の静的検証に加え、隔離CI #19で実PostgreSQL/PostgREST検証が成功。本番では変更後のcatalog/権限を読み取り専用SQLで検証した。ただし本番HTTP API権限試験は未実施。
