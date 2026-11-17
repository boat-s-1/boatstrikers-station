# Four-table migration creation gap — 2026-11-18

## Method
Read-only SQL against production `supabase_migrations.schema_migrations` for all 133 registered migration statement arrays. Concatenated statements per migration, counted case-insensitive table-name references, searched for conventional `CREATE TABLE [IF NOT EXISTS] [public.]name` and `ALTER TABLE [IF EXISTS] [public.]name` using regex. This is lexical detection, not full SQL parsing; dynamic SQL, quoted names, alternate formatting, and nonmigration bootstrap mechanisms remain possible.

| Table | Migration references | Earliest reference version | Earliest CREATE TABLE | Earliest ALTER TABLE |
|---|---:|---|---|---|
| bs_race_results | 27 | 20260819205938 | none detected | 20260823121913 |
| bs_race_entries | 39 | 20260819205938 | none detected | 20260823120912 |
| bs_race_events | 35 | 20260819205938 | none detected | 20260823120942 |
| bs_ai_predictions | 9 | 20260821040234 | none detected | none detected |

## Assessment
The first few recovered migrations assume several pre-existing `bs_*` tables. The prior disposable-branch error on `bs_race_results` is therefore likely the first visible symptom of a **multi-table baseline gap**. Do not create a minimal `bs_race_results` stub or reorder the 133 recovered migrations. Recover an initial schema with version-aware column history, FK dependency order, and role/RLS/trigger/sequence semantics.

## Gate
No production mutation, Cron change, new billable branch, PR #297 merge, or migration replay authorized. Next: identify baseline object creation from other sources, and use an isolated offline database to validate a separately reviewed baseline before any billable branch request.
