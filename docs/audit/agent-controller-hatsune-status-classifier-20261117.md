# Hatsune NEWS — source-grounded status classification (2026-11-17)

Added a pure, offline-only classifier for `hatsune_news_cron_runs` rows. It distinguishes reported success, reported partial, reported error, fresh running, stale running, missing/unknown statuses and inconsistent timestamps.

- Stale `running` yields `verification_required / completion_unverified_stale`, **not confirmed failure**.
- Reported `error` and `partial` are application log states, not independently verified outcome evidence.
- Every result has `confirmedFailure:false`, `alertEligible:false`, `writeAllowed:false`.
- No source reads, network access, notification sending, production wiring or automatic incident creation.

The default 180-second observation window is a **test/planning parameter**, not a validated scheduler SLA; actual expected schedules and timeouts require independent source verification. Test fixtures are synthetic. Release HOLD.
