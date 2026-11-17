# PR #298 — Cloud ingestion migration implementation sequence and explicit approval boundary

2026-11-17. This is a plan for **future** implementation, not a production run.

## Source-aware architecture
1. **Program bootstrap:** use a single authorized source, independently validate official event manifest, six unique boats and racer IDs per race, and source freshness. Atomic insert/merge must preserve existing BRDB program provenance and result/payout values.
2. **Exhibition:** keep PC-KYOTEI's unique detailed fields distinct from OpenAPI preview fallback; do not report fallback as equivalent without field-by-field comparison.
3. **Results and payouts:** existing Supabase OpenAPI ingestion continues independently; compare before and after values during isolated tests. Do not re-run Windows v7.
4. **AI and alerts:** identify Windows v7 downstream enqueue/settlement actions. Race-entry insert triggers can fan out alerts; verify replay and idempotency with production-equivalent fixtures before enabling.
5. **Scheduling:** one authoritative cloud fetcher per provider, no parallel polling. Provider-specific rate limits, cache, exponential bounded retries, stop-on-429, source provenance, and health alerts. BRDB Q011 requires `SOPDT >= D-10` and `OPDT = D`; no live BRDB requests until provider cadence/terms confirmed.

## Phase gates
- Phase A (done): source diagnosis, Windows v7 last runtime, gap monitor, BRDB Q011 official guidance, offline fixture CI.
- Phase B (pending): capture Windows PC-KYOTEI task/export implementation **without running it**, confirm licenses; inspect upstream OpenAPI source terms and available complete program payload.
- Phase C (pending): isolated PostgreSQL production-equivalent triggers and one-transaction rollback, payload identity and duplicate/partial cases, complete historical results preservation, source parity.
- Phase D (pending): controlled canary implementation limited to explicitly enumerated race keys, independently authenticated invocation, monitoring and rollback; no all-day canary disguised as a single-race test.
- Phase E (requires separate explicit approval): change production Supabase RPC/Cron or Vercel flags, verify persisted rows and user-facing freshness, retire Windows jobs permanently only after parity.

## Operational stop criteria
Stop on missing provider permission, missing official race manifest, zero/partial 6-boat programs, unexpected trigger side effects, existing payout modifications, race identity collisions, or a worker that could write without authentication. Keep PR Draft/HOLD until resolved.

## Evidence
- `PR298-BRDB-Q011-VERIFIED-SQL-GATE-20261117.md`
- `PR298-WINDOWS-V7-LAST-RUNTIME-READONLY-20261117.md`
- `PR298-PRODUCTION-READONLY-WINDOWS-DEPENDENCY-GAP.sql`
- `PR298-WINDOWS-FREE-CUTOVER-ACCEPTANCE-20261117.md`

No DB/Cron/Vercel mutation or upstream API calls performed.
