# Cloud sync offline gate — draft / no production changes

This isolated module validates race keys in memory only. It has **no database client, network calls, credentials, scheduler, or write operations**.

Run with Node.js 18+: `node --test scripts/cloud-sync-offline/*.test.mjs`. This includes 9 race-key tests, 10 six-boat tests, and 10 cross-source batch tests (29 total). A local Node.js 22.16.0 reproduction of these files passed all 29 tests on 2026-11-16 (29 pass, 0 fail, 0 skip). GitHub Actions has not been run. The batch gate requires an independent expected-race manifest and fails closed for empty data or mismatched event/entry race sets. The manifest itself must be authenticated and checked against official scheduling before any production use.

The returned `PASS_OFFLINE_ONLY` is **not** permission to write to Supabase. It checks race-key structure and duplicates, not 6-boat completeness, archival source authenticity, BRDB field parity, or official schedule completeness.

## Release HOLD criteria
- Obtain authentic archived OpenAPI/BRDB input and compare all relevant race keys.
- Verify exactly six valid racer entries per race, with cancellation handling.
- Isolated Supabase transaction/rollback and idempotency tests must pass.
- Review the existing `app/api/live/openapi-preview/route.js` endpoint: both GET and POST reach service-role RPC calls, with no authorization check in that route. Confirm middleware and deployment protections before any public-facing change.
- Do not alter existing race results or payout rows.
- Explicit production approval required. Do not merge or deploy this draft as a recovery mechanism.

Production read-only investigation on 2026-11-16 found 600 saved result rows for 2026-11-13 through 2026-11-16 lacking corresponding base events and full six-boat entries. This is a **results-key subset**, not proof of the full official schedule.
