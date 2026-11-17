# Agent Controller — database-side transition guard (2026-11-17)

A disposable PostgreSQL CI test installs a **test-only** trigger that rejects disallowed `notification_outbox.delivery_state` transitions. It verifies:
- `pending_review → delivered` is rejected.
- `pending_review → approved → in_flight → delivered` succeeds with a synthetic receipt.
- `delivered → pending_review` is rejected.

The trigger is **not deployed to production** and is not yet part of the production DDL draft. It checks transition shape, not the authenticity of operator approval, receipt, or worker fencing token. Those require independently authenticated data and real integration. No actual notification is sent.

Release status: HOLD; Draft PR #299.
