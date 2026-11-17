# Agent Controller — DB/application outbox state parity (2026-11-17)

An offline unit test now reads the disposable PostgreSQL CI schema and the outbox transition trigger alongside the application's exported `OUTBOX_STATES`.

The test fails if:
- the PostgreSQL `delivery_state` CHECK constraint differs from the application's six states;
- a nonterminal application state is missing as a source state in the isolated DB transition trigger;
- `delivered` is accidentally given an outgoing transition.

This prevents a repeat of the 2026-11-17 CI failure caused by missing `in_flight` and `delivery_unknown` in the disposable PostgreSQL CHECK constraint.

**Scope:** static consistency of the isolated CI scripts, not an introspection of production schema or proof that application transition code is wired to the actual worker. Deployment remains HOLD.
