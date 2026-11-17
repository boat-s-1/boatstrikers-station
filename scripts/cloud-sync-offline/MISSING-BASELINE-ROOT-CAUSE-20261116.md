# Why a fresh Supabase branch lacks the BoatStrikers core schema

Read-only production inspection on 2026-11-16.

## Evidence
- `supabase_migrations.schema_migrations` contains **133** migration records.
- The earliest recorded version is `20260819205859` (`ai_v2_phase1`).
- The beginning of this earliest migration explicitly says: **"New tables only. Existing prediction tables and production UI are not modified."**
- The later bootstrap migration `20260923133247` (`add_openapi_bootstrap_rpc`) is present in the history.
- A new, user-approved Supabase branch reached `FUNCTIONS_DEPLOYED / ACTIVE_HEALTHY` but had no `bs_race_events`, `bs_race_entries`, or `bs_apply_openapi_bootstrap`; only 7 public tables were observed.
- The branch was deleted and absence was verified.

## Diagnosis
The migration history appears to start **after** initial BoatStrikers tables were created. Therefore replaying the recorded migrations cannot be assumed to reconstruct the pre-existing baseline schema. This is a **likely root cause**, not a fully proven causal chain: migration replay logs and repository migration coverage must still be checked.

## Baseline schema size confirmed by read-only catalog query
- `bs_race_events`: **56 columns**.
- `bs_race_entries`: **107 columns**.
- `bs_race_results`: **18 columns**.
- A simplified two-table mock would not reproduce production trigger, column, and FK behavior. Schema fidelity must be explicit.

## Remediation proposal — not executed
1. Export a **schema-only** baseline of the production database, excluding data, auth secrets, roles, storage objects, credentials, and user content. Treat definitions of functions, triggers and RLS policies as sensitive code and review before committing.
2. Reconcile the baseline with all 133 recorded migrations, avoiding duplicate CREATEs and destructive ALTERs.
3. In a free local PostgreSQL sandbox or separately approved isolated environment, apply the baseline and migrations in a documented order, checking `bs_race_events`, `bs_race_entries`, `bs_apply_openapi_bootstrap`, FKs, and relevant triggers.
4. Only after schema reproduction succeeds, repeat the 600-race/3600-entry archive test with transaction rollback and idempotency checks.
5. Keep the production write gate closed pending explicit authorization.

## Read-only queries used
```sql
SELECT version,name,cardinality(statements) AS statement_count
FROM supabase_migrations.schema_migrations ORDER BY version LIMIT 10;

SELECT left(statements[1],2300)
FROM supabase_migrations.schema_migrations
WHERE version='20260819205859';

SELECT to_regclass('public.bs_race_events'),
       to_regclass('public.bs_race_entries'),
       to_regprocedure('public.bs_apply_openapi_bootstrap(jsonb,jsonb,timestamp with time zone)');
```

Do not attempt another paid branch until baseline creation and replay are demonstrably reproducible.
