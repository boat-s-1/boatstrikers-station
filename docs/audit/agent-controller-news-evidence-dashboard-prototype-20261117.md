# AI司令塔 — 初音ニュース証拠統合表示（隔離試作、2026-11-17）

`news-pipeline-evidence-summary.mjs` integrates three existing pure offline classifiers: Cron replay safety, article time-window reconciliation, and insert outcome classification. It has 13 offline tests.

## Display semantics
- `記録上の成功`: a reported `success` run and full reported insert count. **Not** end-to-end proof of website rendering, notification delivery, or actual pipeline health.
- `一部問題あり`: a reported `partial` run or reported insert conflict/error/partial count.
- `要確認`: unknown completion, absent insert evidence, or other ambiguous combination.

Every result reports `pipeline_health=未確認`, `article_attribution=unproven`, and disables automatic replay and republishing.

## Known limitations
Input evidence is supplied by callers; this module does not fetch or independently authenticate it. `created_at` time-window matching is correlation, not job attribution. `error` run status with no insert evidence remains `要確認`, not a claim that nothing happened. This is not yet a UI or deployed monitoring agent.

## Before production integration
Require authenticated evidence provenance, a clear status vocabulary and timestamps, source-specific failure details without secrets, UI differentiation between scheduler execution and business success, access control, concurrency failure tests, and separate approval for any production changes.

No production writes, deployment, scheduled jobs, notifications, or API fetches.
