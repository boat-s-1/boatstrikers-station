# Agent Controller — outbox transition guard (2026-11-17)

Added `cron-monitor-outbox-transition-guard.mjs` as a **pure, offline, fail-closed proposal function**, with 16 unit tests.

Permitted path: `pending_review → approved → in_flight → delivered`, with explicit review required for approval and authenticated receipt required for delivered. Failure and worker-loss branches are separate: `in_flight → failed` or `delivery_unknown`. Unknown delivery outcome **never automatically retries**; it requires manual reconciliation. Delivered is terminal.

This module does not read a real receipt, authenticate a provider, persist a transition, operate a worker, or send a notification. Boolean flags are supplied by callers and are **not independently verified**; integration must bind them to actual authorization and receipt verification. Real deployment remains HOLD.
