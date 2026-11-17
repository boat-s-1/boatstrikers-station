# Fresh Supabase bootstrap / baseline schema audit (2026-11-18)

## Executive result

The failure is not isolated to `public.bs_race_results`. The production migration history assumes a pre-existing baseline schema that is not provisioned by the recorded migration chain. A fresh branch cannot be expected to replay all migrations successfully until this baseline is recovered from an authoritative source and versioned.

No production or branch SQL was changed in this investigation. No data was copied. The failed hourly branch `community-acl-verification-20261118` was deleted after evidence capture; current project branch listing confirms it is absent.

## 1. Reproduced failure

- Production project: `rzosrbkyniyedolhkgxo`, PostgreSQL 17.6.1, region ap-northeast-1, status ACTIVE_HEALTHY.
- Isolated branch: `community-acl-verification-20261118`, hourly charge approved at US$0.01344, `with_data=false`.
- Branch applied 11 migration rows, latest `20260820194818`; production has 133 rows, latest `20261116123313`.
- Branch reached `FUNCTIONS_DEPLOYED` / preview DB `ACTIVE_HEALTHY`, but those statuses did not mean all DB migrations were applied.
- Migration `20260820210127` / `ai_v2_public_character_stats` failed with SQLSTATE `42P01` at 2026-11-17 16:16:55.578Z because `public.bs_race_results` was missing.
- Production contains `public.bs_race_results`; the recorded 133 migration SQL statements contain zero `CREATE TABLE public.bs_race_results` statements.

## 2. Original migration source inspected

- Historical branch `feature/ai-v2-phase1` contains 10 migration files for the original AI v2 work.
- `supabase/migrations/20260820_ai_v2_training_refresh.sql` on that branch creates/replaces a function; it does not create `bs_race_results`.
- That function references these existing production relations: `bs_race_entries`, `bs_race_events`, `bs_race_result_entries`, `bs_race_results`, `racer_gender_master`.
- Current main file `supabase/migrations/20260821_ai_v2_public_character_stats.sql` also references `bs_race_results` and does not create it.
- The first recorded migration reference to all five core relations is `20260819205938` / `ai_v2_training_refresh`.
- The function `ai_v2_refresh_training_rows` is PL/pgSQL, so some missing relation references are not resolved until execution; the SQL-language stats function is the first observed hard stop.

## 3. Baseline relations referenced by migration history but not created by a recorded CREATE TABLE migration

Read-only scan of all 133 recorded migration statements identified 13 existing public tables referenced by migrations for which no direct `CREATE TABLE` statement appears in the recorded migration set. This is a dependency lead list, not a claim that each relation is necessarily required by every fresh install; unusual/dynamic DDL paths should still be checked.

| Relation | First referencing migration | Relation type |
|---|---|---|
| `racer_gender_master` | `20260819205938` / `ai_v2_training_refresh` | table |
| `bs_race_entries` | `20260819205938` / `ai_v2_training_refresh` | table |
| `bs_race_events` | `20260819205938` / `ai_v2_training_refresh` | table |
| `bs_race_result_entries` | `20260819205938` / `ai_v2_training_refresh` | table |
| `bs_race_results` | `20260819205938` / `ai_v2_training_refresh` | table |
| `bs_ai_predictions` | `20260821040234` / `ai_v2_site_prediction_bridge` | table |
| `races` | `20260823122005` / `create_openapi_live_sync` | table |
| `bs_member_notification_preferences` | `20260830184310` / `add_ichika_escape_surge_line_notification` | table |
| `upcoming_races` | `20260901214052` / `secure_public_ai_today_views_phase3c` | table |
| `bs_ai_bet_results` | `20260901214227` / `secure_public_ai_bet_aggregates_phase3d` | table |
| `bs_news_candidates` | `20260903162034` / `news_verification_and_x_pipeline` | table |
| `bsc_results` | `20260912200945` / `automate_official_performance_sync` | table |
| `seminar_magazine_issues` | `20260926140543` / `add_seminar_article` | table |

Two referenced views, `v_elimination_training_races` and `v_bs_race_results_confirmed`, are also detected by the table-only scan, but they are view objects rather than missing base tables and are created/managed by view migrations. They are not included in the 13-table count.

## 4. Production catalog snapshot of the first five dependencies

Read-only metadata only; no row contents were queried.

| Table | Columns | RLS | Key constraints observed |
|---|---:|---|---|
| `bs_race_entries` | 107 | enabled | PK(id); unique (race_date, course_code, race_no, boat_no); FK to bs_race_events; course/boat checks |
| `bs_race_events` | 56 | enabled | PK(id); unique race key (duplicate unique constraints/indexes are present); race/course checks and status check |
| `bs_race_result_entries` | 17 | enabled | PK(id); unique (race_date, course_code, race_no, boat_no) |
| `bs_race_results` | 18 | enabled | PK(id); unique (race_date, course_code, race_no) |
| `racer_gender_master` | 7 | enabled | PK(racer_id); gender check F/M |

Important attached objects observed:
- `bs_race_entries`: 5 non-internal triggers, including exhibition write guard, first-seen tracking, bootstrap reconciliation and Ichika alert evaluation; 9 indexes; two SELECT-only RLS policies.
- `bs_race_events`: 2 non-internal triggers; 6 indexes; two SELECT-only RLS policies.
- `bs_race_result_entries`: 3 indexes; two SELECT-only RLS policies.
- `bs_race_results`: 3 indexes; trigger `trg_bs_track_result_first_seen`; public SELECT policies.
- `racer_gender_master`: 2 indexes. Its grants/policies need a separate deliberate review.

Catalog grants on several of these tables include broad `anon` / `authenticated` privileges (including DML and TRUNCATE) despite read-only RLS policies being the observed policies. This is a separate least-privilege/security workstream; no grant or policy was changed. Do not copy these grants blindly into a baseline migration. Determine intended runtime roles and validate API exposure separately.

## 5. Wider schema inventory lead

The production public schema has 160 ordinary/partitioned tables. A static scan of all 133 recorded migration statements did not find a direct `CREATE TABLE` statement for 95 of them:

```text
ai_calibrated_predictions, ai_calibration_models, ai_characters, ai_control_jobs,
ai_diagnoses_v3, ai_ensemble_predictions, ai_factory_events, ai_factory_jobs,
ai_factory_workers, ai_job_events, ai_job_logs, ai_jobs, ai_live_results,
ai_model_registry, ai_model_versions, ai_predictions, ai_predictions_legacy_v81,
ai_product_settings, ai_race_diagnoses, ai_system_status, ai_uploaded_files,
ai_worker_heartbeats, blog_authors, blog_blocks, blog_categories, blog_media,
blog_post_authors, blog_post_relations, blog_post_revisions, blog_post_tags,
blog_posts, blog_publication_events, blog_tags, blog_templates,
boatstrikers_engine_v3_runs, brdb_import_jobs, brdb_race_entries_raw,
bs_ai_bet_results, bs_ai_entry_history, bs_ai_history_runs, bs_ai_predictions,
bs_ai_race_history, bs_course_baselines, bs_entries, bs_events,
bs_exhibition_ai_rows, bs_ichika_consultations, bs_ichika_validation_history,
bs_ichika_validation_milestones, bs_member_feature_usage_daily,
bs_member_notification_preferences, bs_news_candidates, bs_news_correction_log,
bs_news_short_drafts, bs_race_entries, bs_race_events, bs_race_live,
bs_race_note_features, bs_race_payouts, bs_race_result_entries, bs_race_results,
bs_results, bs_sync_commands, bs_sync_logs, bs_sync_runs, bs_sync_runtime,
bsc_results, daily_events, daily_votes, hatsune_news_cron_runs,
hatsune_scheduler_config, home_ticker_items, ichika_live_predictions,
ichika_training_features, magazine_issues, multi_ai_predictions, race_entries,
racer_gender_master, races, radio_blog_posts, realtime_updates,
seminar_magazine_issues, social_post_logs, stadium_ai_snapshots,
stadium_ai_snapshots_v2, stadium_data_engine_runs, stadium_data_engine_runs_v2,
stadium_data_snapshots, stadium_guides, stadium_season_stats,
stadium_trifecta_stats, stadium_yearly_stats, upcoming_race_entries,
upcoming_races, weekly_schedule_items
```

This is a static SQL-text inventory, not proof that all 95 are missing from every deployment mechanism. It can miss dynamic DDL, extension-created objects, `CREATE TABLE AS` variants, or source files outside the migration directory. It is a review backlog; do not create all 95 objects from current catalog metadata without tracing ownership and source.

## 6. Repository vs database migration history

- Current GitHub main `supabase/migrations/` contains 56 `.sql` files.
- Production `supabase_migrations.schema_migrations` contains 133 rows.
- A normalized exact-name comparison matched 45 names. 11 repo SQL filenames and 88 DB history names did not have an exact normalized-name match.
- Some names intentionally differ (e.g. descriptive filename vs migration registry name), so the mismatch is a source-of-truth reconciliation signal, not proof that 88 SQL bodies are absent.
- GitHub main and the historical AI v2 branch were inspected. The historical AI v2 migration files do not contain the missing core table DDL.
- Search of the Library found a legacy `boat_strikers_ai_schema_v1.sql` for the older BRDB CSV model (`races`, `race_entries`, `ai_predictions`, etc.). It does not define the modern `bs_race_*` canonical tables and is not an authoritative replacement.
- A separate 2026-08-05 local diagnostic report records that the local PC-KYOTEI database did not have the canonical `bs_race_entries`, `bs_race_results`, or `bs_race_result_entries` tables; it is not a schema export of production.
- The 2026-11-15 Phase 0 ledger explicitly notes that all historical branch commits, backups, and external environment files had not been exhaustively audited. Therefore source provenance remains unresolved.

## 7. Actions and current status

- The hourly branch was deleted after evidence capture; current branch listing confirms it is absent.
- The main project is ACTIVE_HEALTHY. The only remaining non-main branch is the pre-existing `gamagori-pr294-phase13` (status MIGRATIONS_FAILED); it was not modified.
- No production DDL/DML, grants, RLS policies, Auth settings, secrets, Edge Functions, or Vercel configuration were changed.
- No new branch remains running, so the approved hourly branch charge is no longer accruing.
- PR #300 remains Draft / unmerged. All three GitHub checks on the latest documentation commit `9f63796c568fd0887a94da1e0a0de15d0c6324f8` completed successfully: Community security checks, Racer Profile Dry Run, and Discord PR 289 checks.

## 8. Required next steps before any new branch

1. Obtain an authoritative schema-only export or backup for the production baseline, including table DDL, constraints, indexes, triggers, policies, grants, sequences/identity, extensions, functions and dependent types. Use the Supabase backup/restore path or a trusted local `pg_dump --schema-only` export; do not query or export production row data for this task.
2. Reconcile the 133 migration registry rows against all 56 repository SQL files by SQL body/content and source commit, not filename alone. Recover missing migration source files or document migrations applied outside Git.
3. Trace the first five canonical race tables and the other eight baseline table dependencies to their actual creation source (older commits/branches, dashboard SQL, local deployment artifacts, backup, or another repo). Do not infer an original DDL from current columns alone.
4. Build a reviewed bootstrap baseline in Git as a separate, ordered foundation layer. Preserve required runtime behavior but review least-privilege ACLs rather than reproducing current broad grants.
5. Reconcile all 95 catalog leads and every function/view/trigger dependency. Mark objects as (a) migration-created, (b) baseline-required, (c) extension-generated, (d) legacy/unused, or (e) unknown.
6. Only then create a fresh hourly branch (with a fresh cost check/confirmation if needed), require every migration to apply, compare schema fingerprints and catalog objects, and then begin ACL/API regression tests.

## Conclusion

The original user-approved isolation branch did its job: it exposed that BoatStrikers' recorded migrations are not a self-contained fresh-install bootstrap. The failure is broader than one table. The next safe step is recovery and reconciliation of the authoritative baseline, not hand-writing a replacement table or skipping migrations.
