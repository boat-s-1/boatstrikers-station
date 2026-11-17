# Agent Controller — read-only monitoring snapshot gate (2026-11-17)

Added `cron-monitor-snapshot-gate.mjs` with 11 offline tests. The pure function rejects absent, stale, future-dated, malformed, duplicate-attempt and unverified-source snapshots. A valid-shaped snapshot is **only eligible for offline review**; `notificationAllowed` and `writeAllowed` remain false.

**Important limitations:** `readonlyVerified` and the query fingerprint are caller-supplied values. This module does not independently verify Supabase roles, authenticate source identity, fetch production data, detect missing scheduled windows, or establish causality between Cron and news. Real monitoring input must be separately verified. No external reads/writes or notifications are performed. Production rollout HOLD.
