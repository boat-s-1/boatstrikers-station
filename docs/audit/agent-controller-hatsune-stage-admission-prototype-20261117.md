# 初音ニュース — 60秒制限向けステージ入場判定の隔離試作 (2026-11-17)

## Scope
Added `tools/agent-controller/cron-stage-admission.mjs` and 12 offline tests. No connection to production route, Cron, Supabase, network or publishing.

The pure function uses explicit elapsed time, execution cap, completion reserve and expected stage budget. Prototype defaults: cap 60,000 ms, reserve 8,000 ms. A stage is admitted only if its declared budget fits before the reserve. Skipped stages are marked `must_record_skip`; no automatic retries, no claim of pipeline health.

## Important limitations
- 8,000 ms is a **hypothesis for offline testing**, not a measured production guarantee.
- This does **not** interrupt a stage that overruns its budget, ensure a database update completes, or persist a skipped-stage record.
- Runtime caps may include setup, database latency and platform overhead. Real integration would need monotonic timing, explicit request aborts, bounded DB logging, response semantics for partial/skipped work, and idempotency checks.
- Avoid marking a skipped official news source as a business error that triggers automatic replay or republishing.

## Exit criteria before any production change
1. Measure per-stage latency in an isolated environment and select reserve from observed tail latency.
2. Add abort/deadline enforcement and safe log-update error handling.
3. Test failure injection for 60-second termination, source timeout, DB update failure, and duplicate-run avoidance.
4. Obtain separate approval before changing production route, timeout, schedule or deployment.
