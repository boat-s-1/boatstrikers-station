# Actual production trigger behavior — read-only inspection 2026-11-16

## Directly inspected function bodies
- `trigger_evaluate_ichika_escape_surge_alerts`: calls `public.evaluate_ichika_escape_surge_alerts()` only when `new.race_date = (now() at time zone 'Asia/Tokyo')::date`. Historical backfill avoids this direct today-date branch, but other effects must still be tested.
- `bs_settle_theory_recommendations_from_event`: returns early if `new.trifecta is null`; otherwise loops unsettled rows in `bs_theory_recommendations` and calls `bs_settle_theory_recommendation(id)`. SECURITY DEFINER. A bootstrap event insert sets no trifecta, so this trigger should return early on the basic bootstrap path, subject to other triggers.
- `bs_reconcile_bootstrap_event_after_entry`: updates `bs_race_events` to `BRDB_RECONCILED` when an entry switches away from BOATRACE_OPEN_API_BOOTSTRAP and no bootstrap entries remain for the race. Ordinary initial bootstrap insertion does not meet this condition.
- `bs_track_entry_first_seen`: calls `bs_record_first_seen` when preview or PC-KYOTEI exhibition timestamps are present. Bootstrap entry insertion sets `api_synced_at`, but **not** `api_preview_synced_at` or `exhibition_synced_at` explicitly. Defaults/other triggers still need review.
- `bs_guard_exhibition_write`: invokes `bs_merge_exhibition_payload` on entry INSERT/UPDATE; therefore even initial bootstrap entries pass through a payload merge function that needs separate inspection.
- `bs_apply_openapi_bootstrap`: SECURITY DEFINER, inserts missing events and entries via natural-key `ON CONFLICT DO NOTHING`. It marks newly inserted events `race_status='scheduled'`, including historical dates; downstream consumers must not mistake this for actual race status. It returns inserted/received counts but does not assert 6 complete boats per race or non-null racer details. The offline gate must reject malformed payload before invoking this RPC.

## Practical next gate
1. Inspect `bs_merge_exhibition_payload`, `bs_record_first_seen`, `evaluate_ichika_escape_surge_alerts`, and `bs_settle_theory_recommendation` in read-only mode.
2. Inspect column defaults and other trigger ordering.
3. Confirm exact API-to-RPC payload mapping and all 600 race keys, 3600 boat keys before writing.
4. Reconstruct baseline schema before any isolated database test.
5. Production remains HOLD; do not invoke bootstrap on production.

No production changes were made during this review.
