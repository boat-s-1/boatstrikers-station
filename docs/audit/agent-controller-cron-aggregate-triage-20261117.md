# AI司令塔 — 読み取り専用集計の診断接続（隔離試作、2026-11-17）

`cron-aggregate-triage.mjs` composes the strict read-only aggregate schema with the evidence provenance gate. It accepts caller-supplied aggregate evidence only; there is no live Supabase connection.

The triage flags unfinished run logs, partial runs and windows with no temporally observed article. Unfinished and partial together yield `high_review`, one of them yields `review`, neither yields `observation_only`. These are heuristic operator-review priorities, not operational failure rates. The count of temporally matched articles is not per-run attribution, and a zero-article window does not prove a failed job.

Synthetic/stale/non-production inputs cannot be treated as current production evidence. All reports prohibit automatic retry/republish and never verify delivery or live health. The fixture counts used in tests reflect a prior aggregate snapshot but are not live measurements or source-attested data.

Seventeen offline tests. Before a live adapter, review least-privilege SQL, authenticated provenance, consistent observation timestamps, rate limits, and explicit authorization for production integration. No production mutations or deployment.
