# PR298 Cloud cutover — staged, independently approved plan

**Status: HOLD / no production changes authorized.** The goal is to eliminate
dependence on the Windows v7 sync worker without silently changing race-data
semantics. Current-day ingestion and historical repair are distinct projects.

## Phase A: read-only baseline (no approval required)
1. Confirm actual active production Cron definition and last executions; verify
   whether `bs_sync_openapi_today()` calls bootstrap. Do not invoke any
   write-capable route or RPC while diagnosing.
2. Run `PR298-DAILY-PROGRAM-CONTINUITY-READONLY.sql` and compare 11/11–11/12
   healthy days against 11/13 onward. Capture counts and query timestamps.
3. Inspect program/result source priority, triggers, dependencies and permissions
   in production. Do not assume the disposable CI fixture represents all 133
   production migrations.
4. Confirm upstream OpenAPI payload has the official race schedule and complete
   six-boat registrations. A results-only source cannot bootstrap a program.
5. Record external provider terms and allowed polling cadence. Team-Nave BRDB
   Q009 warns against excessive polling; Q011 requires a date window.

## Phase B: isolated rehearsal (development authorization only)
1. Use an approved isolated environment with production-compatible schema,
   fixtures and non-sensitive sample payloads.
2. Test full atomic candidate: bootstrap -> preview entries -> preview events
   -> results; same-transaction rollback on any failed step.
3. Test repeated runs, duplicate keys, mismatched registration, stale/future
   timestamps, concurrent runs, trigger fan-out and caller permissions.
4. Verify exact day boundary in JST and no writes outside the target date.
5. Capture CI links, SQL hashes, before/after counts and rollback evidence.

## Phase C: production change — explicit authorization required
1. Obtain separate approval for SQL installation, Cron change and any Vercel
   deployment, with exact commit and rollback plan.
2. Deploy only approved function(s), with least-privilege EXECUTE and no public
   invocation; verify grants before enabling any scheduled caller.
3. Use a **single** scheduled writer to avoid duplicate and conflicting jobs.
   Never enable a new writer while the old writer is active without an approved
   overlap/fencing strategy.
4. On the first permitted run, verify expected races, six entries per race,
   unchanged results/payouts, and source-priority invariants.
5. Roll back or stop on missing program, partial race, incorrect registration,
   source mismatch, excessive load or any unauthorized side effect.

## Phase D: Windows retirement — separate approval required
1. Observe cloud-only success across multiple event days, including a JST date
   rollover and race completion. Compare official schedules, not only result rows.
2. Inventory all Windows jobs and consumers (Auto Sync Ultimate v7, BRDB-API,
   PC-KYOTEI, exhibitions, alerts and dependent features). Record replacements.
3. Prove each required data family has a cloud source or mark it explicitly
   unsupported; do not assume OpenAPI replaces exhibitions or all BRDB fields.
4. Only after accepted parity and user approval, disable Windows scheduling
   using a reversible procedure. Do not delete Windows data or credentials.

## Hard gates
- No automatic production migration from a green CI run.
- No current-day Cron change to fix historical gaps; those require separately
  approved archive-backed repair.
- No historical repair using results to invent program registrations.
- No Windows shutdown until all critical feeds have documented replacements.
