# BoatStrikers production migration recovery

Recovery branch: `codex/migration-recovery-audit-20261118`
Source project: `rzosrbkyniyedolhkgxo` (production; read-only access used)
Source table: `supabase_migrations.schema_migrations`
Source rows: **133**
Recovered SQL payload files: **133**

## What was recovered

Each `.sql` file under `supabase/migrations_recovered/` is reconstructed from the corresponding stored `statements` array using this exact join separator:

```text
\n;\n
```

This preserves the SQL statement text held in the production migration registry, but it is **not a byte-for-byte recovery of the original local migration source files**. Original comments/formatting that were never stored in the registry cannot be recovered from this source. The SHA-256 in `migration-recovery-manifest.csv` is calculated over the reconstructed joined SQL payload.

## Audit summary

- 133 of 133 production migration registry rows had non-empty SQL statement arrays.
- 133 recovered payload files were committed to this branch.
- 45 production migration names have matching filenames in the checked historical Git branches/main by name.
- 88 production migration names did not have a same-name SQL file in the checked main/historical branch set.
- 11 SQL files in main did not have a same-name production migration registry entry.
- Lexical scan flags: 9 Cron-related; 38 contain tokens such as DROP/TRUNCATE/DELETE; 46 contain GRANT/REVOKE tokens. These are screening flags only, not a semantic safety review.

## Critical safety notice

**Do not replay these files against production or a live environment as a batch.** The recovered sequence contains data mutations, object replacements, permission changes, Cron scheduling, and other operational effects. Files are evidence/recovery inputs, not an approved deployment plan.

Before any use in a new environment:
1. compare every recovered statement with the current schema and current migration history;
2. classify dependencies and ordering;
3. identify data backfills, destructive operations, privilege changes, and Cron changes;
4. prepare an isolated database and disposable test data;
5. run migrations only in that isolated environment, then verify expected schema/data/cron state.

## Scope and provenance

- SQL retrieval used read-only SELECT queries against the production migration registry.
- No SQL from these files was executed.
- Production tables, schema, data, and Cron jobs were not modified.
- GitHub `main` and PR #297 were not modified.
- This branch is a recovery/audit branch only; it is not a merge candidate.
- Credentials, connection strings, and secret values are intentionally excluded.

See `migration-recovery-manifest.csv` for version, name, payload byte length, SHA-256, and lexical screening flags.
