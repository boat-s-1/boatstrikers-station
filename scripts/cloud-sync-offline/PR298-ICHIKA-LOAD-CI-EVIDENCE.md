# PR298 isolated load measurements — 2026-11-17

Source: GitHub Actions run 44091800912, job 134068537022, commit a83b2c50.
All test assertions PASS. Times below are **CI PostgreSQL fixture measurements**,
not production service-level objectives.

| Test | Scope | Measured |
| --- | --- | --- |
| Trigger-call stub | 240 races / 1,440 boats total; 12 boats pre-existing, 1,428 newly inserted | 1,428 calls; 20.5 ms |
| Real-query-equivalent Ichika evaluator | 144 races / 864 boats; 864 evaluations on initial program-only INSERT | 1,603.0 ms |
| Conflict-safe replay | 240-race fixture | PASS, zero additional trigger calls |
| Alert correctness | 144-race fixture | PASS, no alerts before exhibition complete; one qualified alert after six boats complete; replay preserves uniqueness |

Important qualifications:
- The 20.5 ms result uses an observable stub evaluator and is **not**
  comparable to the 1,603.0 ms query-based evaluator result.
- The latter recreates the current production SQL query and alert uniqueness
  semantics in simplified disposable tables, **not** full production schema,
  indexes, RLS, concurrent workers or external notifications.
- A six-boat bootstrap on the current day invokes the evaluator six times,
  even with null exhibition values; historical days skip this evaluator.
- These numbers do not authorize production Cron replacement, historical
  backfill, trigger changes, or Windows retirement.

Remaining GO/HOLD gates:
1. Verify actual OpenAPI source payload and allowed use/cadence.
2. Test exact production trigger/function body with representative
   data and all dependent objects in an isolated database.
3. Verify end-to-end candidate ingestion against captured authentic
   payload and source identity, including rollback.
4. Obtain explicit approval for each production mutation and a
   rollback plan. Keep PR Draft/HOLD until then.
