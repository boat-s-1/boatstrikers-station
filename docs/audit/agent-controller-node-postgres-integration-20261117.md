# Agent Controller — Node-to-PostgreSQL integration CI (2026-11-17)

Added `tools/agent-controller/isolated-node-db-adapter-ci.mjs` and wired it into the existing disposable PostgreSQL 17 GitHub Actions job.

This is a **real Node process invoking real PostgreSQL transactions**, not a pure function simulation. It checks incident/outbox reservation, replay uniqueness, compare-and-swap approval and claim, a synthetic worker-loss transition to `delivery_unknown`, and the refusal to automatically claim again.

Safety boundary: the adapter refuses to run unless `PGHOST=127.0.0.1`, `PGPORT=5432`, `PGDATABASE=agent_controller_ci`, and `PGUSER=agent_ci`. It uses hard-coded synthetic incident IDs, no production credentials, no external notifications and no live Cron data. The script is a CI integration harness, **not a deployable production worker**. SQL operations use fixed literals, and no user-controlled SQL is accepted.

This does not prove authenticated approvals/receipts, external idempotency, lease fencing across the Node/DB boundary, or production schema compatibility. Release remains HOLD; Draft PR #299.
