# Read-only preflight: constraints, triggers, and deterministic ID collisions (2026-11-16)

**Scope:** production Supabase `rzosrbkyniyedolhkgxo`, metadata and SELECT-only inspection. No bootstrap RPC execution, no inserts, no deployment.

## Constraints verified
- `bs_race_entries` foreign key `(race_date,course_code,race_no)` references `bs_race_events` with `ON DELETE CASCADE`.
- `bs_race_events` has unique natural race keys; `bs_race_entries` has unique natural race+boat keys.
- `bs_race_results` has a separate unique natural race key. The bootstrap RPC itself does not update this table.
- The events table has two unique constraints with the same natural key, requiring later schema cleanup review; **do not** remove one as part of this recovery.

## Trigger inventory
- `bs_race_events`: 2 non-internal triggers.
- `bs_race_entries`: 6 non-internal triggers.
- `bs_race_results`: 1 non-internal trigger.
- Entry INSERT invokes `bs_race_entries_exhibition_guard` (BEFORE INSERT), `trg_bs_track_entry_first_seen` (AFTER INSERT), and `trg_ichika_escape_surge_on_exhibition_update` (AFTER INSERT or exhibition-field UPDATE).
- The last trigger invokes `evaluate_ichika_escape_surge_alerts()` when `new.race_date` equals current JST date. Thus current-day backfill may invoke alert evaluation, even if the intended backfill only supplies base program data. Do not assume it is side-effect-free.
- The first-seen trigger records exhibition observations only when corresponding preview or PC-KYOTEI synchronization fields are present; downstream function/other trigger effects still need isolated verification.

## Read-only deterministic negative-ID collision preflight
Calculated exactly the event and entry negative IDs used by `bs_apply_openapi_bootstrap` for the 600 saved-result race keys (2026-11-13 to 2026-11-16), without inserting anything.

| Candidate ID set | Candidates | Existing primary-key collisions |
|---|---:|---:|
| Event IDs | 600 | 0 |
| Entry IDs (6 boats/race) | 3600 | 0 |

This checks current primary-key collisions only. It does not prove future idempotency, trigger safety, correct player data, or transactional success.

## Isolation blocker
The existing Supabase branch `gamagori-pr294-phase13` (`rdqnqvafsponsoetnezv`) reports `MIGRATIONS_FAILED` and belongs to PR #294, so it must **not** be reused for this test. No healthy dedicated isolated branch was identified. Creating a new Supabase branch can incur charges and must be cost-confirmed by the user.

## Release HOLD
1. Obtain a healthy isolated DB with current schema and test data.
2. Exercise the real bootstrap RPC under transaction rollback; confirm first insert, repeat no-op, partial input recovery, FK consistency, and no unintended alert side effects.
3. Recheck current-day/archived cancellation statuses before backfill.
4. Explicitly approve a narrowly scoped production write after isolation evidence.
