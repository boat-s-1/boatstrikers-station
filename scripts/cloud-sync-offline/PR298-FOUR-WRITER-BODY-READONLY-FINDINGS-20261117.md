# PR #298 — Four production OpenAPI writers: read-only body review (2026-11-17)

Production project `rzosrbkyniyedolhkgxo`. Source: `pg_get_functiondef` for three writers, compared with previously captured `bs_apply_openapi_bootstrap`. **Catalog SELECT only; no writer invoked or production data modified.**

## Confirmed writer ordering and semantics

1. `bs_apply_openapi_bootstrap(events,entries,synced_at)`: INSERT missing event and entry keys; `ON CONFLICT DO NOTHING`. Existing metadata is **not refreshed**.
2. `bs_apply_openapi_preview(rows,synced_at)`: UPDATE matching existing entries only; writes API exhibition fields, and preserves populated PC-KYOTEI exhibition fields. A changed API field updates `api_preview_synced_at` and `live_synced_at`; unchanged values do not refresh those timestamps.
3. `bs_apply_openapi_preview_events(rows,synced_at)`: UPDATE matching existing events only; writes API weather/wave/wind fields, and fills regular fields with `coalesce(existing,api)`. It sets `api_preview_synced_at` on every matched update.
4. `bs_apply_openapi_results(results,entries,synced_at)`: UPSERT result rows where `trifecta_result` or `first_boat` exists; UPDATE matching existing entries with finish order/course/ST and matching existing events with payouts/result flags. It **does not create missing event or entry rows**.

## Important integration hazards

- The candidate atomic caller must bootstrap first. If it runs results alone, it can create confirmed result rows with no event/entry rows.
- Bootstrap uses `DO NOTHING`; replays cannot fix stale fields of already-existing rows. Partial 6-boat repair is possible when missing keys are absent.
- Preview entries preserves PC-KYOTEI primary exhibition fields while updating API-specific fields. A test must assert both source priorities.
- Preview event weather fields preserve existing nonnull primary values; API-specific fields may still change.
- Results writer has `coalesce(existing,excluded)` for some result status and API timestamp fields. A newer replay does not necessarily replace those existing values.
- Results writer's `UPDATE bs_race_events` can trigger recommendation settlement; entry exhibition changes may trigger Ichika fanout depending on which columns the trigger listens to.
- The functions are SECURITY DEFINER. Recreating them in a disposable database requires explicit role grants and a dependency/trigger review, not simply executing the SQL against production.

## Next isolated test gate

Build a disposable schema with actual referenced columns and constraints; load the three catalog-captured bodies **unchanged** alongside the captured bootstrap body; run candidate atomic caller against them. Assert first-save, replay, PC-KYOTEI precedence, partial settlement, and injected results failure rollback across all tables. Recheck trigger fanout separately with parity guards.

**Release status: Draft/HOLD.** No production SQL, Cron, Vercel or paid branch changes authorized by this review.
