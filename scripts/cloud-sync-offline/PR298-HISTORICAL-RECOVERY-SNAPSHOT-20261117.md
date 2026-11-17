# PR #298 — Historical recovery snapshot (read-only, 2026-11-17 JST)

This document records an observed **moving snapshot**, not a completed historical repair.

Production Supabase read-only SELECT against bs_race_results LEFT JOIN bs_race_events on (race_date, course_code, race_no):

| JST date | Result rows without program | Of those, trifecta payout nonnull | Distinct courses |
|---|---:|---:|---:|
| 2026-11-13 | 156 | 156 | 13 |
| 2026-11-14 | 168 | 168 | 14 |
| 2026-11-15 | 156 | 156 | 13 |
| 2026-11-16 | 120 | 120 | 10 |
| 2026-11-17 | 129 | 129 | 11 |
| **Total** | **729** | **729** | not additive |

The November 17 count increased from earlier observations as results continued to arrive. This is **not** evidence that 729 source program payloads are available or that every historical program can be recovered. Source completeness, six-boat identity, and permission must be established before any recovery.

Recovery acceptance:
1. Source-specific archived payload for each JST date; no current-day `today.json` substitution.
2. Independently validate official date/course/race keys and all six boat identities, including registration IDs; compare to already saved results.
3. Confirm no overwrite of existing results, payouts, program provenance or downstream alerts.
4. Validate in isolated PostgreSQL with production-equivalent triggers, rollback, replay, and explicit date/race allowlist.
5. Separate, explicit authorization before any production writes.

Current `bs_apply_openapi_atomic_candidate` **rejects historical dates**, so cannot serve as backfill mechanism unchanged.

No production write, Cron change, Vercel change, or upstream provider fetch performed.
