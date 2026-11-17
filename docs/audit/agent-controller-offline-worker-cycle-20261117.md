# Agent Controller — offline worker-cycle planner (2026-11-17)

A deterministic offline orchestration layer, `cron-monitor-worker-cycle-planner.mjs`, now composes the existing fail-closed outbox transition guard across a sequence of steps.

Ten tests cover normal synthetic lifecycle, missing operator review, missing receipt, worker crash, unresolved delivery, reconciled delivery, terminal delivered replay, and invalid inputs. It always returns `sendAllowed:false` and `persistenceAllowed:false`, and cannot perform I/O.

**Not a live worker:** test flags do not authenticate operator identity or provider receipt. This only models decision sequencing; real database transactions, polling, leases, credential scopes, provider integration and monitoring source are not wired together. Keep deployment HOLD and PR Draft.
