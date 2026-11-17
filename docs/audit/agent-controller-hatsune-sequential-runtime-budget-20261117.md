# 初音ニュース — 60秒上限と逐次工程の時間予算（2026-11-17）

## Verified route code (read-only)
`app/api/cron/hatsune-news-pipeline/route.js` declares `maxDuration=60`. After authentication and optional start log, it awaits, sequentially: `collectHatsuneNews`, `syncHatsuneMediaNews`, `syncBoatstrikersGeneralNews`, optional `ensureHatsuneDailyMinimum` when base+media inserts are zero, optional `generatePendingHatsuneArticles({limit:4})` when OPENAI_API_KEY exists, then `finishHatsuneCronRun`. The route has no shared deadline budget or reserved completion-log time.

`lib/boatstrikersGeneralNewsSync.js` performs up to 8 parallel repair fetches, 3 parallel source-list fetches, and up to 16 parallel article-enrichment fetches (each `AbortSignal.timeout(3500)`), plus DB reads/writes. This **does not** mean each group takes exactly 3.5 seconds: DB, parsing, scheduling and other stages add time. The collector, media, fallback and AI stage durations are not yet individually measured. The verified Vercel runtime error includes a 60-second timeout, but no per-stage attribution.

## New isolated simulation
`tools/agent-controller/cron-stage-budget-simulation.mjs` and 13 tests simulate sequential stage budgets with hypothetical durations. Default cap 60,000 ms, reserve 8,000 ms; once a stage is skipped, subsequent business stages are also skipped. It models an optional fallback and AI stage, and reports whether a hypothetical log-write duration fits. It does not enforce wall-clock time, cancel a running request, or persist logs.

## Limitations and next work
- Simulated durations are synthetic and **not** measurements.
- The existing production route does **not** skip stages or reserve time.
- Even if the simulation says logging fits, real network/DB delays and platform termination can still prevent completion.
- Before any production patch: gather stage-level timing in isolated tests, design deadline propagation/abort, avoid duplicate inserts or replays, preserve partial-work semantics, and verify a log-write failure path.
- No production writes, Cron edits, retries, deployment or merge.
