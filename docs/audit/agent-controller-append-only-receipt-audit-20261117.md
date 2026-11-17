# Agent Controller — CI-only append-only receipt audit (2026-11-17)

Added a PostgreSQL BEFORE UPDATE OR DELETE trigger on the disposable CI table `agent_monitor.receipt_conflict_audit_ci`. It rejects ordinary row edits/deletes, verifies all original rows remain, and confirms a new audit record can still be appended.

**Not tamper-proof:** privileged PostgreSQL owners/superusers can disable triggers, truncate or drop tables, or change the function. No off-database append-only storage, cryptographic anchoring, role-separated privileges, retention controls or external audit service is present. This trigger only raises the bar against accidental or ordinary DML mutation in the CI fixture. It is not deployed to production. Release HOLD.
