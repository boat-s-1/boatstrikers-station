# Hatsune NEWS — 7-day live status cross-check (2026-11-17)

Read-only production query grouped `public.hatsune_news_cron_runs` for job `pipeline` by JST date, 2026-11-11 through 2026-11-17.

| JST date | Recorded pipeline runs | running | partial | success | error |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2026-11-17 | 3 | 1 | 2 | 0 | 0 |
| 2026-11-16 | 3 | 0 | 3 | 0 | 0 |
| 2026-11-15 | 3 | 0 | 3 | 0 | 0 |
| 2026-11-14 | 3 | 0 | 3 | 0 | 0 |
| 2026-11-13 | 3 | 1 | 2 | 0 | 0 |
| 2026-11-12 | 3 | 2 | 1 | 0 | 0 |
| 2026-11-11 | 3 | 1 | 2 | 0 | 0 |

Totals: 21 pipeline log rows; 5 `running`, 16 `partial`, zero `success` and zero `error` in this seven-day subset. The three pg_cron schedules each have seven scheduler invocations and latest scheduler statuses `succeeded`, but that is a separate layer and does not prove pipeline completion.

**Interpretation:** The `partial` state is written when the application counts at least one error, including a missing `OPENAI_API_KEY` configuration; it is not necessarily total failure. The `running` state is unverified completion; the app's finish logging update does not inspect the returned DB error. The data does not identify root causes without sanitized per-run errors and downstream article evidence.

Do not invoke pipeline endpoints, automatically replay work, or issue alerts from this aggregate alone. No production writes or schedule changes. Release HOLD.
