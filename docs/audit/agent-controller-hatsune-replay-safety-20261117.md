# 初音ニュース Cron — 途中終了時の再実行安全ゲート (2026-11-17)

Isolated offline implementation: `cron-replay-safety.mjs` and 12 tests.

The gate takes only a finite run status, coarse publication evidence, and a boolean idempotency verification flag. It never receives raw article content, error strings, user data, or credentials.

All input combinations return `automatic_replay_allowed=false` and `automatic_republish_allowed=false`. A `running` row, absent completion log, or absent publication evidence is **not** proof of no side effects. Even an independently verified idempotency mechanism is insufficient to authorize replay without separate operational review.

This intentionally conservative prototype does not execute any action or determine a safe manual replay procedure. Before any manual replay, operators must reconcile run IDs, article source keys, uniqueness constraints, prior publications, external deliveries, and partial writes. Keep separate records for scheduler invocation, application completion, DB article creation, public publication, and notification delivery.

No production modifications, retries, Cron changes, network fetches, or deployments.
