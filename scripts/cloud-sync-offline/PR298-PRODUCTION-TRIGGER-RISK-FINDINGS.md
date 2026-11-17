# PR298 — Production trigger fan-out risk findings (2026-11-17)

**Read-only metadata review only. No trigger was invoked and no row was written.**

## Verified production behavior
| Trigger | Timing | Consequence / verification needed |
|---|---|---|
| `bs_race_entries_exhibition_guard` | BEFORE INSERT OR UPDATE of entries | Calls `bs_merge_exhibition_payload`; verify that OpenAPI bootstrap inserts cannot overwrite higher-priority exhibition values |
| `trg_bs_reconcile_bootstrap_entry` | BEFORE UPDATE of entries | Transitions bootstrap-origin entries to `BRDB_RECONCILED` when enriched fields arrive; preserve source priority |
| `trg_bs_reconcile_bootstrap_event_after_entry` | AFTER UPDATE of entries | Can update parent race event source when all bootstrap entries have been reconciled |
| `trg_bs_track_entry_first_seen` | AFTER INSERT OR UPDATE of entries | Calls `bs_record_first_seen` for preview/PC-KYOTEI timestamps; test replay idempotence |
| `trg_ichika_escape_surge_on_exhibition_update` | AFTER INSERT or UPDATE OF exhibition/lap columns | Invokes `evaluate_ichika_escape_surge_alerts()` on current JST date; test fan-out, load and duplicate alert behavior |
| `trg_settle_theory_recommendations` | AFTER INSERT or UPDATE OF trifecta/payout on events | Settles pending theory recommendations; do not let program bootstrap fabricate payout values |

Two additional updated-at triggers on events and entries and the
result-first-seen trigger on results are also active.

## Priority tests before production cutover
1. Bootstrap six-boat INSERT with no exhibition values: guard must preserve
   valid existing exhibition state and not create fake measurements.
2. Replay the same bootstrap: no unintended UPDATE, alert or first-seen churn.
3. Apply preview after bootstrap: confirm exactly intended exhibition updates,
   stable provenance and bounded alert evaluation.
4. Enrich a bootstrap entry from BRDB: verify `BRDB_RECONCILED` and parent
   event transition without clobbering data.
5. Settle result with real payout: verify theory settlement occurs once and
   rollback of any later failure reverses all writes in the transaction.
6. Run with production-compatible trigger definitions and full schema,
   not only simplified fixture stubs.

**Important:** A successful fixture CI run does not prove the above trigger
side effects are safe in production. No production install or Cron repoint
until all cases are evidenced and approved.
