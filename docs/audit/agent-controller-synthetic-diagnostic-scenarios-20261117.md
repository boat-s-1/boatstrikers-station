# 初音ニュース — 実観測を参考にした合成シナリオ検証（2026-11-17）

Added `tools/agent-controller/cron-diagnostic-scenarios.test.mjs` (12 tests) against the unified offline report builder. All run IDs, durations, and stage outcomes in this test are synthetic; they are **not** actual production row payloads or claims of per-stage timing.

## Cases
1. Running-like record, no finish-log evidence, but temporally observed article records: `要確認`, no replay or republish, no assumption of zero side effects.
2. Partial-like record with reported stage failure and 58-second hypothetical request: `一部問題あり`, delivery not verified.
3. Timeout-like record at hypothetical 60-second duration, articles present: `一部問題あり`, no republishing.
4. No article in a window: not permission to retry.
5. Completion-like record with no article evidence: no end-to-end delivery claim.
6. Unaccounted request duration and limited headroom surfaced without attributing cause.

## Production evidence boundary
Earlier read-only aggregates showed unfinished `running` rows, `partial` rows and temporally correlated news articles, plus Vercel's 60-second runtime timeout. They do not establish actual stage durations or per-run article causality. These tests are isolated and use no production data writes, API requests, retries, deployments or Cron edits.

## Next step
Introduce a strict read-only evidence input adapter that validates provenance and timestamps, rather than letting a caller silently label synthetic input as verified production measurements.
