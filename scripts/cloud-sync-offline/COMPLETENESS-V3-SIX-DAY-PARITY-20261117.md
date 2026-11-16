# PR #298 — six-day V3 SQL-body parity and key uniqueness

Read-only SELECT against production, 2026-11-11 through 2026-11-16. Unified existing quality rows with result-only keys, matching the candidate's detection CTE; grouped by date and counted duplicate (course_code,race_no) keys.

| date | unified races | issues | missing base | duplicate keys |
|---|---:|---:|---:|---:|
| 11/11 | 144 | 0 | 0 | 0 |
| 11/12 | 156 | 1 | 0 | 0 |
| 11/13 | 156 | 156 | 156 | 0 |
| 11/14 | 168 | 168 | 168 | 0 |
| 11/15 | 156 | 156 | 156 | 0 |
| 11/16 | 120 | 120 | 120 | 0 |

This validates read-only query behavior and key uniqueness for observed data. It is not a PostgreSQL CREATE FUNCTION or recorder/notification integration test. Isolated PostgreSQL installation and lifecycle verification are still required. No production writes or scheduler changes.
