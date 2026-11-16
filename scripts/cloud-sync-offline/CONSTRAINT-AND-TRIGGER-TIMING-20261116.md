# Bootstrap database constraint and trigger timing gate — 2026-11-16

Read-only catalog inspection of production.

## Verified constraints
- `bs_race_events`: primary key `id`; unique natural race key `(race_date,course_code,race_no)` (two named unique constraints); CHECK course 1..24, race 1..12; `race_status` limited to `scheduled, exhibition, open, closed, finished, cancelled`.
- `bs_race_entries`: primary key `id`; unique natural boat key `(race_date,course_code,race_no,boat_no)`; FK to event natural key `ON DELETE CASCADE`; CHECK course 1..24, race 1..12, boat 1..6, and official exhibition course 1..6 or NULL.
- `bs_race_results`: primary key id and unique natural race key.
- Non-null core event columns: `id,race_date,course_code,race_no,race_status,synced_at,created_at,updated_at`. Event `result_available` defaults false.
- Non-null core entry columns: `id,race_date,course_code,race_no,boat_no,synced_at,created_at,updated_at,official_parts_changed,exhibition_field_meta`. Last two JSONB fields default to empty array/object.

## Trigger timing
- Entry exhibition guard: **BEFORE INSERT OR UPDATE**.
- Entry first-seen tracker: **AFTER INSERT OR UPDATE**.
- Entry alert evaluator: **AFTER INSERT OR UPDATE OF** exhibition/lap columns. Because it includes INSERT, the date guard matters even for bootstrap inserts without exhibition values.
- Entry reconciliation: **BEFORE UPDATE** and **AFTER UPDATE**, not initial INSERT.
- Event theory settlement: **AFTER INSERT OR UPDATE OF** trifecta/payout; bootstrap event INSERT is subject to trigger but returns early when trifecta is NULL.
- Event updated_at: **BEFORE UPDATE**.

## Restore safety
1. Event rows must exist before entry rows to satisfy FK. Bootstrap RPC inserts events then entries.
2. A 6-boat count is not enforced by FK/unique constraints: require the offline six-boat gate.
3. Historical bootstrap events use `race_status='scheduled'`, `result_available=false` default. Verify consumers of historical race status; do not automatically update to `finished` without a separate tested reconciliation policy.
4. Do not DELETE events during tests on production: FK has ON DELETE CASCADE.
5. Compare full schema and trigger definitions in isolation, not just names/counts.
6. No production writes or paid branch creation performed.
