# AI司令塔 — 集計監視の隔離実装と本番導入ゲート（2026-11-17）

## Delivered in Draft PR #299
- Strict aggregate-only read-only SQL, reviewed EXPLAIN, and manual production read-only result (63 runs, 34 unfinished, 29 partial, 58 windows with articles, 428 temporal matches at 2026-11-17T08:41:40Z).
- Evidence provenance and age gates, triage and fetch admission policy.
- Incident policy, append-only event-ledger projection, alert reservation decision, recovery review, and cross-module offline tests.
- All components are pure offline functions. They do not access network, write storage, schedule jobs, send notifications, or automatically retry/replay.

## Production release gates — HOLD
1. **Explicit approval:** identify production deployment scope, operator, notification channel, schedule, cost ceiling, rollback owner and maintenance window. This PR does not grant approval.
2. **Least privilege:** establish read-only SQL access scoped to only aggregate tables, verified credential rotation and no raw secrets in logs.
3. **Performance:** measure query duration with bounded statement timeout, confirm index strategy for article created_at, enforce one-row aggregate output and a safe execution budget. The current EXPLAIN uses a sequential scan of articles.
4. **Authenticity:** independently verify timestamps, query fingerprint, environment and evidence origin. Caller-supplied flags do not authenticate themselves.
5. **Durability and concurrency:** implement a real append-only attempt ledger and atomic unique alert reservation (database transaction or equivalent). Current in-memory projection and dedupe decision are **not** distributed locks and are not durable.
6. **Delivery:** choose a channel and authenticated notifier, receipt semantics, suppression/cooldown, escalation and privacy policy. The current alert-delivered event is caller-supplied and does not prove actual delivery.
7. **Recovery:** require consecutive authenticated healthy observations and manual incident closure. Never infer service health from an empty or stale result.
8. **Rollback:** explicit kill switch, no backfill, no retry loop, no provider API access, no TRINITY collector restart, no news auto-replay.
9. **Release:** review green GitHub Actions, audit SQL, review draft PR, then obtain separate permission for production deployment.

## Known caveats
- A temporal article match is not proof the corresponding run created or published the article.
- 'running' with no finish log is not proof the article stage did not complete.
- Alert cooldown logic uses caller-supplied timestamps and requires persistent atomic enforcement in production.
- The event ledger is an in-memory projection; no file/database was modified by its operation.
- Recovery observations are caller-supplied, not independently authenticated.

## Recommendation
Keep PR #299 Draft and production automation HOLD until the above gates are satisfied. Continue with offline verification, independent review and bounded read-only observation only.
