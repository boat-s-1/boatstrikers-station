# AI司令塔 — 診断証拠の出所・時刻・鮮度（隔離試作、2026-11-17）

`tools/agent-controller/diagnostic-evidence-provenance.mjs` validates explicit caller-supplied evidence metadata. Allowed origins are synthetic fixtures, read-only Supabase aggregate observations, read-only Vercel runtime observations and manual observations. Every observation requires timezone-aware ISO timestamp, reference timestamp, and an allowlisted environment.

A configurable default 15-minute age window distinguishes `within_age_window` from `stale`. The age threshold is a display/triage policy, not proof that a pipeline is healthy. A future observation is rejected. Synthetic fixtures cannot be labeled production; all synthetic evidence is `test_only`. Stale evidence is for `historical_review`. Other evidence still requires manual review.

**Important:** This module does not authenticate the caller, cryptographically verify origin, retrieve current server time, or validate underlying DB/API truth. `independently_verified=false` and `current_production_status_claim_allowed=false` are intentionally fixed. Before production use, a read-only authenticated adapter must supply and attest provenance, validate timestamp semantics, and distinguish observation time from event time.

16 offline tests; no live reads or writes, no provider API, Cron modifications, deployment, retry, or republish.
