# Agent Controller — PostgreSQL receipt-required transition guard (2026-11-17)

New disposable-PostgreSQL CI step `isolated-postgres-receipt-guard-ci.sh` installs a **test-only** BEFORE UPDATE trigger on the CI outbox table. It refuses a transition to `delivered` when no matching receipt row is present, checks that the failed update leaves the row `in_flight`, then commits a synthetic receipt and `delivered` state in one transaction. It also checks the existing terminal-state guard rejects reopening delivered.

The trigger runs after other integration scenarios to avoid changing their test fixture assumptions. The script rejects nonlocal/non-CI PostgreSQL targets. It does not authenticate the receipt, identify a real operator, verify provider-side idempotency, or apply a production migration. An attacker or privileged process able to forge receipt rows could still bypass the conceptual protection. The schema is simplified CI-only, not the production schema.

Deployment and real notification delivery remain HOLD.
