# AI司令塔 — 証拠ゲート付き統合診断（隔離試作、2026-11-17）

The pure offline `cron-evidence-gated-report.mjs` composes the existing diagnostic report with the evidence provenance validator. It does not access live sources.

## Display rules
- Synthetic fixture or synthetic environment: `テストデータ`, never a live operational conclusion.
- Stale observation: `過去の観測`, not a claim about the present.
- Other observations: show the conservative underlying diagnostic display, but `production_current_status_verified=false` remains fixed, because supplied source metadata is not authenticated.

Explicit gates flag synthetic input, staleness, non-production environments, and unverified provenance. No auto-retry, republish or health assertion is permitted. A current production observation remains manual-review evidence only.

## Important distinction
An authenticated read-only adapter with source identity, server time and bounded query semantics would be required to establish trustworthy current observations. Even then, observing a Cron row or an article row does not prove end-to-end publication or delivery.

17 isolated tests. No production DB writes, Cron edits, provider API requests, live notifications, deployments, or merges.
