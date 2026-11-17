# PR #298 — captured bootstrap RPC validation (2026-11-17)

Scope: GitHub Actions disposable PostgreSQL 17 database only. The function body is extracted unchanged from `SIX-TABLE-ISOLATION-CANDIDATE.sql`, itself a prior read-only production catalog capture. No production writes.

## CI assertions

- One race and six entries: initial save counts 1 event + 6 entries.
- Exact replay: 0 event + 0 entries added.
- Malformed numeric input: event and entries roll back.
- Partial program: an existing event and boats 1–2 remain unchanged; boats 3–6 are added.
- Missing parent event: entry insert fails with a foreign-key violation.
- Cross-race malformed entry: neither earlier nor later race persists.
- **Important behavior to gate:** the captured bootstrap RPC silently filters boat numbers outside 1–6. It can insert an event with zero entries; caller must reject incomplete/invalid program payloads **before** invoking this RPC. This test records existing behavior, not a proposed production change.

## Remaining release blockers

The CI schema is intentionally minimal and does not execute all production trigger side effects. The captured preview entries, preview events, and results RPC bodies have not been executed against schema-parity isolation. Production OpenAPI response parity, authenticated PostgREST execution, and Cron cutover remain unverified. Keep PR Draft/HOLD; no production SQL, Cron, Vercel, or paid branch changes.
