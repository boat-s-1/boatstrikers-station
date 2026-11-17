# PR #298 — Source count transition and safe next gate (2026-11-17)

**Read-only production evidence; no deployment or production mutation.**

| JST date | Reported races | Maximum reported entries | Final reported entries | Calls with entry count not divisible by 6 | Calls with full six-boat aggregate | Persisted races / entries |
|---|---:|---:|---:|---:|---:|---|
| 11/11 | 144 | 864 | 864 | 0 | 62 | 144 / 864 |
| 11/12 | 156 | 936 | 936 | 0 | 62 | 156 / 936 |
| 11/13 | 156 | 935 | 935 | 192 | 0 | 0 / 0 |
| 11/14 | 168 | 1003 | 1003 | 258 | 0 | 0 / 0 |
| 11/15 | 156 | 935 | 935 | 89 | 0 | 0 / 0 |
| 11/16 | 120 | 718 | 718 | 225 | 0 | 0 / 0 |

All dates have 310 `live_all` calls with `status='success'`. The last observation is based on the final timestamp per date, not the maximum from a different call. Entries grow during the day, so earlier incomplete counts are expected; the **end-of-day deficits after Nov 12** are the actionable anomaly.

**Strong observation:** On Nov 11–12, every reported entry count was a multiple of six. From Nov 13, non-multiples appear and final counts are short by 1, 5, 1, 2 respectively. This is consistent with missing individual boat records in the source-reported collection, but does **not** prove whether the source, transformation, or logging layer is responsible. The persisted event/entry disappearance has the same date boundary but causation is unproven.

**Potential trap:** A global six-boat count can still hide one incomplete race offset by an overfull/duplicate race. A strict per-race unique boat + racer identity check remains mandatory.

## Safest next actions

1. Inspect the exact read-only source ingestion transformation and Git history at the 11/12–11/13 boundary, without modifying production.
2. Retrieve one full representative official OpenAPI JSON document (or a redacted archived snapshot) and identify which race/boat IDs are absent or malformed; do not rely on aggregate log counts.
3. Decide whether to reject the entire day or quarantine only incomplete races. If adopting partial acceptance, never advertise a missing race as a valid prediction or quietly overwrite existing complete data with incomplete data.
4. Test the chosen policy against production-equivalent trigger side effects, idempotent retries, and concurrent Cron runs in an isolated database.
5. Keep PR Draft/HOLD and do not switch production Cron before a monitored canary and explicit approval.

**CI:** `0d69015e` PostgreSQL fixture and offline contract both SUCCESS; no production writes.
