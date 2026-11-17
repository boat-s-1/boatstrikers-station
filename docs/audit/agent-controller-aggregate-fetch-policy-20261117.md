# AI司令塔 — 集計データ定期取得の安全設計（2026-11-17）

This is an **offline-only** policy prototype, not a deployed poller or approval. `cron-aggregate-fetch-policy.mjs` accepts explicit operator-supplied metadata and returns `hold` or `eligible_for_separate_operator_review`. The latter is not authorization and does not start any operation.

Proposed conservative gates (subject to operational review):
- Verified read-only credential and environment; no key values printed or stored.
- Separate explicit approval for any live production automation.
- SQL fingerprint verification and query-plan review.
- Minimum 60 minutes between attempts, including failed attempts; no retry loops.
- Max 5,000 ms query duration, one aggregate output row, max 15 minutes observation age.
- Missing/future/stale timestamps and invalid inputs fail closed.
- The policy has no network, Supabase SDK, scheduler, secrets, or write functions; no automatic news replay, TRINITY collector access, or production mutations.

**Remaining before deployment:** independently authenticate evidence and timestamps; establish a least-privilege connection mechanism, SQL statement timeout, resource budget, safe failure alerts, durable attempt ledger, credential rotation, audit logging and explicit production approval. The policy cannot attest that its boolean inputs are true. The earlier read-only aggregate and EXPLAIN are manual evidence only.

Twenty-four offline tests were added. PR remains Draft; no schedule, secrets, Cron, database schema or Vercel changes.
