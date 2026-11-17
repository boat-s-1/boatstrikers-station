# bs_race_results baseline object read-only inventory（2026-11-18）

## Production definition snapshot
`public.bs_race_results` exists in production but not in a fresh branch after 11 migrations.

Columns (19):
- `id bigint NOT NULL`
- `race_date date NOT NULL`
- `course_code smallint NOT NULL`
- `race_no smallint NOT NULL`
- `first_boat integer`, `second_boat integer`, `third_boat integer`
- `trifecta_payout integer`, `trifecta_popularity integer`
- `api_result_source text`, `race_status text`, `result_status text NOT NULL DEFAULT 'finished'`
- `trifecta_result text`, `winning_method text`, `winning_technique text`, `winning_trifecta text`
- `api_result_synced_at timestamptz`, `synced_at timestamptz NOT NULL DEFAULT now()`

Constraints / indexes:
- Primary key `bs_race_results_pkey` on `(id)`
- Unique `(race_date, course_code, race_no)`
- Index `idx_bs_results_race` on `(race_date, course_code, race_no)`

Trigger:
- `trg_bs_track_result_first_seen` AFTER INSERT OR UPDATE -> `bs_track_result_first_seen()`

RLS:
- RLS enabled (verified in prior catalog audit)
- Policies include public read policies; policy definitions are permissive SELECT predicates.

Grants observed on production:
- `anon` and `authenticated` have SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE.
- `service_role` has SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE.
- `postgres` has grantable equivalents.

## Security note
The wide anon/authenticated ACL is a separate production least-privilege issue. It was not modified. Do not conflate it with the migration bootstrap gap or assume the failed branch exposed production data. No test data or production data was copied to the branch.

## Provenance status
- The main DB migration row `20260820210127` stores the function creation SQL and does not create `bs_race_results`.
- GitHub default-branch code search for `bs_race_results` returned no indexed hits. This is not conclusive proof that no historical source exists; older branches, deleted files, prior deployments, manual SQL, or another repo may contain it.
- The original creation source and full dependency history remain unresolved. Do not reconstruct the table from this snapshot alone; the inventory is evidence for locating the authoritative source and for review, not an approved bootstrap migration.

## Branch cleanup
After capturing the logs and schema evidence, the hourly branch was deleted successfully. `list_branches` confirmed that `community-acl-verification-20261118` no longer exists. The only remaining non-main branch in this project is the pre-existing `gamagori-pr294-phase13` with status `MIGRATIONS_FAILED`; it was not modified.
