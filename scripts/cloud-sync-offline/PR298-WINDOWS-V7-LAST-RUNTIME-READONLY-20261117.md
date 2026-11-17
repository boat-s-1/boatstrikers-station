# PR #298 — Windows v7 shutdown: production runtime evidence

2026-11-17. **Read-only** Supabase query against `bs_sync_runtime`, `bs_sync_commands`, `bs_sync_logs`.

## Verified
- `bs_sync_runtime.id=1`: `worker_name='windows-v7'`, `state='idle'`, `last_status='success'`, `version='7.2.1'`.
- Last successful worker runtime `finished_at=2026-11-11T15:52:37.773226Z` = **2026-11-12 00:52:37 JST**. The runtime summary's `target_date` is **2026-11-12**.
- The recorded BRDB step processed `racemst_rows=156`, `racedtl_rows=936`, `events=156`, `entries=936`, `event_unchanged=156`, `entry_unchanged=936`, `event_written=0`, `entry_written=0`. Therefore this specific run did **not** insert the rows; it found them already present.
- Runtime summary includes successful `pc_kyotei_live_results` and `pc_kyotei_live_payouts` steps, and an exhibition step with `waiting_exhibition` because no same-day exhibition rows were available at that time. The latter is not a successful exhibition-data update.
- AI enqueue returned success, but `written_rows=0`, `skipped_incomplete_exhibition=156`.
- `bs_sync_commands` had **0 pending/running**; last requested command was Aug 1. `bs_sync_logs` latest started Jul 28. These separate legacy command/log tables are not a substitute for the detailed `bs_sync_runtime` summary.
- Independently, persisted `bs_race_events/entries` exist on Nov 11/12 but are absent on Nov 13 onward (prior read-only daily audit).
- The temporal match strongly supports that stopping Windows v7 removed a baseline writer, but no exact task-disable timestamp or alternate writer inventory has been proven.

## Migration consequences
1. Cloud replacement must cover at least baseline BRDB program rows, PC-KYOTEI result/payout and exhibition functions, and any AI downstream jobs currently launched by v7. Do **not** assume OpenAPI alone covers all of these fields.
2. BRDB API provider explicitly requested cessation of five-minute high-volume polling and Q011 SQL optimization. Do not resume Windows v7 or replicate its polling rate in cloud.
3. The existing OpenAPI Cron only updates previews/results and does not create base events/entries. The separately implemented Next.js bootstrap path is disabled for today by feature flag and must not be invoked casually.
4. Verify independent source licensing and compare actual field coverage; design separate source-specific schedules, provenance and a single authoritative writer.
5. Keep Draft/HOLD until full trigger, permissions, source compliance and end-to-end replay tests pass. No production mutation in this investigation.
