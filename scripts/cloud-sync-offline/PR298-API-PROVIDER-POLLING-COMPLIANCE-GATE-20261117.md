# PR #298 — Provider-requested polling stop: mandatory compliance gate

2026-11-17. User reports that the API provider asked them to stop five-minute API polling, so they disabled the Windows Task Scheduler. This is **not** permission to restart polling or migrate the same traffic to cloud infrastructure.

## Verified facts
- Read-only inspection of live `bs_sync_openapi_today()` shows an HTTP GET to `https://boatraceopenapi.github.io/api/v1/today.json`.
- Existing production Cron `boatstrikers-openapi-live-3m` invokes this function every three minutes during its scheduled window. This was already running and was not changed in PR #298.
- The live function does not call the bootstrap writer, and its `entry_rows` logs count preview data, not scheduled racer records.
- User reports stopping Windows Task Scheduler after a provider request to stop five-minute retrievals.
- It is **not yet known** whether the provider's request refers to this same public OpenAPI endpoint, a separate API used by Auto Sync Ultimate v7, or both.

## Mandatory gate before any migration/cutover
1. Identify the exact API/service named in the provider communication and the requested restriction (frequency, endpoint, authorization, caching, redistribution, or complete cessation).
2. Inventory Windows task endpoint(s) without re-enabling tasks or making API requests. Inventory production Cron endpoint(s) using read-only configuration.
3. If provider restriction applies to current Supabase Cron, promptly seek an authorized operator decision to pause/reconfigure it; do not silently increase or shift traffic.
4. Choose a compliant source and refresh cadence. A cloud migration is not an exemption from provider limits.
5. Validate any substitute using offline fixtures, rate limits, retry/backoff, caching and a single centralized fetcher. Do not use multiple jobs to bypass rate limits.
6. Obtain explicit approval for production Cron changes, even if the change is to pause it.

## Status
HOLD: do not deploy candidate, restart Windows scheduler, increase polling, or perform live probing of the potentially restricted endpoint. No production modifications made by this PR.
