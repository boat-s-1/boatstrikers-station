# Production migration identity reconciliation — 2026-11-16

Read-only comparison of GitHub branch `codex/cloud-sync-offline-gate-20261116` and production Supabase migration history.

- GitHub `supabase/migrations`: **56 SQL files** (57 directory entries including one MD).
- Production migration history: **133 recorded versions**.
- **4 exact version matches**, **129 recorded versions without a same-numbered SQL file**.
- **52 GitHub SQL files without a matching production version**.
- Full recursive GitHub tree: **2139 entries, not truncated**; SQL outside `supabase/migrations` includes `database/exhibition-acquisition-status.sql`, `database/exhibition-write-guard.sql`, `ops/blog/staging-cron.sql`, `supabase/proposals/20261026_admin_job_locks.sql`, two SQL tests, and this PR's read-only schema comparison SQL. No obvious core baseline file surfaced by filename search. Filename search is not proof no baseline exists inside another file.

## Exact matching versions
- `20260919171921` — restore_results_and_harden_daily_sync
- `20260919173207` — add_race_data_quality_alerts
- `20260919180044` — secure_internal_tables_and_functions
- `20260926140543` — add_seminar_article

## First production-only recorded versions
- `20260819205859` — ai_v2_phase1
- `20260819205938` — ai_v2_training_refresh
- `20260819210143` — ai_v2_escape_label_fix
- `20260819210227` — ai_v2_escape_label_fix_v2
- `20260819210740` — ai_v2_training_top3_recovery
- `20260819210818` — ai_v2_training_top3_alias_fix
- `20260820170334` — ai_v2_training_rows_compact
- `20260820191433` — ai_v2_champion_challenger_registry
- `20260820192155` — ai_v2_daily_ranking_type_expand
- `20260820194650` — ai_v2_normalize_training_scales
- `20260820194818` — ai_v2_normalize_training_scales_key_fix
- `20260820210127` — ai_v2_public_character_stats
- `20260821040234` — ai_v2_site_prediction_bridge
- `20260823120912` — add_openapi_preview_fallback
- `20260823120942` — add_openapi_preview_weather_fallback

## Interpretation and next gate
**Version mismatch is not automatically missing SQL content**: repository migrations may have been renamed or consolidated. However, a fresh paid Supabase branch previously lacked `bs_race_events`, `bs_race_entries` and bootstrap RPC, and the earliest repository migration is later than the earliest recorded production version. The combination is strong evidence that the current migration chain cannot be trusted as a full clone until baseline and replay are reconciled.

Next: locate original table DDL via repository history or schema-only catalog export; build a deterministic schema-only baseline and compare all relevant columns, constraints, indexes, RLS, grants and trigger functions. **Do not create a paid branch or write to production before this gate passes.**

No production writes or Actions were executed.
