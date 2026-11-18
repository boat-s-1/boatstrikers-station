# SU-557322 follow-up draft — approval required before sending

Subject: Re: Request for first failed migration on deleted preview branch — BoatStrikers

Summary: A newly created, no-data preview branch fails migration replay because the production migration history references a core race table not created by the replayed migrations. We need a safe path to reconstruct the original schema baseline.

Impact: Preview branch migration validation and the cloud-only site data restoration are blocked. Production remains unchanged.

Expected behaviour: A preview branch created from the production project replays the required schema and migrations successfully.

Actual behaviour: Branch `dev1-migration-diagnostic-20261119` (`wsqijqnztlcrcozfdotp`) reached MIGRATIONS_FAILED. PostgreSQL at 2026-11-18 17:35:21.010 UTC reported `relation "public.bs_race_results" does not exist`, SQLSTATE `42P01`, while creating `public.ai_v2_public_character_stats` (migration `20260820210127`).

Steps to reproduce: Create a no-data preview branch from project `rzosrbkyniyedolhkgxo`; inspect migration status and the first PostgreSQL error. We deleted the diagnostic branch after collecting logs.

Environment: Organization `epuxscypfyrfyhzwmszo`; production project `rzosrbkyniyedolhkgxo`, region `ap-northeast-1`, PostgreSQL 17.

Troubleshooting completed: The branch applied 11 migration records through `20260820194818`. The three core race tables were absent. The production migration history begins on 2026-08-19; the Git repository's migration files begin 2026-08-21. Current production schema snapshots are later reconstructions, not proven original DDL. Dashboard scheduled backups currently show only 2026-11-11 through 11-17; PITR is not enabled.

Request: Please advise whether a schema-only baseline or older backup from before the first stored migration exists, and the supported way to make preview branch migration replay valid without changing the production database or substituting guessed DDL. If support diagnostic access is required, please specify its exact scope first; it has not been enabled.

This is a prepared draft, not a sent message. Do not include secrets or full logs.
