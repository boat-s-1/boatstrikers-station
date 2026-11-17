# Supabase隔離ブランチ実行結果・Migration停止原因（2026-11-18）

## 作成
- Branch: `community-acl-verification-20261118`
- Branch ID: `51c931bd-9ddf-4ae9-bdbd-22630ec77cd8`
- Project ref: `bvjybdnwahywxolynkjl`
- Parent: production project `rzosrbkyniyedolhkgxo`
- Cost approval: US$0.01344/hour confirmed by user
- with_data=false（本番データ複製なし）
- Branch status reached `FUNCTIONS_DEPLOYED` and preview DB `ACTIVE_HEALTHY`.

## Migration検証（読み取り専用）
- Main: `supabase_migrations.schema_migrations` = 133 rows; latest `20261116123313`; public relations (table/view/materialized/partition) = 199.
- New branch: migration history = 11 rows; latest `20260820194818`; `public.bs_member_profiles` absent; `public.bs_race_results` absent; public relations = 7.
- Branch `list_migrations` returned empty, so direct read-only SQL against `supabase_migrations.schema_migrations` was used as source of truth.

## 原因の特定
- Branch Postgres logs show SQLSTATE `42P01` at `2026-11-17T16:16:55.578Z` during creation of function `public.ai_v2_public_character_stats(date)`.
- Failing dependency: `public.bs_race_results` does not exist in the fresh branch.
- This function is migration version `20260820210127`, name `ai_v2_public_character_stats`.
- Main DB has `public.bs_race_results` and `public.ai_v2_daily_rankings`; fresh branch has `ai_v2_daily_rankings` but not `bs_race_results`.
- The main migration history contains the SQL for version `20260820210127`; it references `public.bs_race_results` but does not create it.
- Therefore the currently recorded migration chain is not self-contained for a fresh database at this point. The migration runner status `FUNCTIONS_DEPLOYED` did not mean all 133 DB migrations were applied. This is a concrete migration bootstrap/dependency gap, not merely a premature status poll.
- The exact origin of `bs_race_results` in production is not yet established (legacy pre-migration schema, manually applied DDL, or another deployment path). Do not guess or create a replacement table from assumptions.

## Safety / action
- No SQL DDL/DML was run on this branch after the read-only inspection.
- No production DDL/DML/GRANT/REVOKE/Auth changes.
- No migration was manually applied or edited.
- No production data was copied.
- Stop ACL testing until a complete, reproducible bootstrap path exists.
- Preserve the failed log evidence in this report; remove the hourly branch after evidence capture to prevent unnecessary charges.

## Required remediation design (not implemented)
1. Inspect production `bs_race_results` exact table definition, indexes, constraints, triggers, policies, grants, dependencies and ownership.
2. Trace its origin through Git history, SQL migrations, backups and previous deployment records; identify all other baseline objects absent from migration history.
3. Build a dedicated baseline/bootstrap migration or a documented schema snapshot from verified source, without production data.
4. Re-run from a brand-new branch and require all 133 migration versions (latest `20261116123313`), `bs_member_profiles`, and expected public schema objects to match before any ACL probe.
5. Only after bootstrap passes, resume ACL tests and then propose minimal production changes in a separate reviewed migration.

## Conclusion
Branch creation itself succeeded, but migration application stopped at version `20260820210127` because its prerequisite `public.bs_race_results` is absent from the fresh branch. The branch status was not a sufficient migration-success signal. The environment is not ready for ACL verification. No production changes were made.
