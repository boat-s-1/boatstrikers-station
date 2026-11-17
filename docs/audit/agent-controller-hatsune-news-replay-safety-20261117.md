# Hatsune NEWS — safe replay boundary (2026-11-17)

Read source `app/api/cron/hatsune-news-pipeline/route.js` and `lib/boatstrikersGeneralNewsSync.js` on `main`.

The pipeline runs collection, media, general-news repair/insert, fallback and AI generation sequentially, then writes a completion log. General-news sync first reads existing titles and source keys, but also updates existing published articles and inserts new ones. Therefore a request that times out or leaves a `running` log may already have committed article writes. Existing-title checks are not a transactional guarantee against concurrent writers; a unique source-key constraint may help with duplicate keys but cannot alone guarantee no duplicate publication or safe replay of repairs.

Added pure `cron-monitor-general-news-replay-gate.mjs` and 10 offline tests. For `success`, `partial`, `error`, `running`, missing status, even with all claimed checks and approval flags, the module **always returns HOLD** and disallows automatic replay, production writes and notifications. This is a decision aid, not an enforcement layer for the existing endpoint.

Before an actual replay mechanism can be considered: independently inspect completed/partial side effects, validate source-key uniqueness in the target DB, test concurrent insert and repair idempotency, design a durable run-level lease and transaction boundary, confirm authorization and obtain fresh explicit production approval. Do not call the existing GET route as a read-only probe: it performs writes.

No production route change or live invocation. Draft PR #299 remains HOLD.
