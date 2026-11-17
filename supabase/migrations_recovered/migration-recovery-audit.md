# Migration recovery audit — static screening

Date: 2026-11-18
Branch: `codex/migration-recovery-audit-20261118`
Scope: 133 SQL payloads reconstructed from production `supabase_migrations.schema_migrations`.

## Screening results

| Lexical marker | Count | Interpretation |
|---|---:|---|
| Cron scheduling markers (`cron.schedule`, `cron.unschedule`, `cron.alter_job`) | 9 | Requires isolated Cron-state review |
| Destructive-looking tokens (`DROP`, `TRUNCATE`, `DELETE FROM`) | 38 | Requires statement-level review; may be safe scoped deletes/backfills |
| Privilege tokens (`GRANT`, `REVOKE`) | 46 | Requires role/ACL review |

These are simple case-insensitive substring screens, not SQL parsing or semantic judgments. A token may occur in a comment, function body, or safe scoped operation; conversely, other risky operations may not be caught. Counts overlap.

## Replay decision

**HOLD — no migration in this recovery set is approved for replay.**

Before isolated replay, perform a statement-level review of dependencies between functions, tables, views, triggers, extensions, and policies; data backfills and mutations; Cron job names, schedules, duplicate-job behavior, and external HTTP effects; grants/revokes and RLS/security-invoker/security-definer behavior; destructive DDL and statements whose effects are not reversible.

A clean-room test database should be provisioned with a known baseline, then migrations applied in exact version order with assertions after each logical group. Cron should remain disabled or redirected to inert test targets until separately approved.

## Provenance limitation

The registry stores a `text[]` of SQL statements. The recovered files join those elements with `\n;\n`. SHA-256 values are over this reconstructed payload, not necessarily the original developer-authored migration file bytes. This audit does not claim byte-identical source recovery.
