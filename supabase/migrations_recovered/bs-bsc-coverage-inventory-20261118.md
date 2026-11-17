# BS/BSC migration coverage inventory — 2026-11-18

## Scope and method
Read-only production catalog and 133 registered migration statements. Enumerated current public ordinary/partitioned tables with names starting `bs_` or `bsc_`; counted case-insensitive literal name mentions and detected conventional unquoted `CREATE TABLE [IF NOT EXISTS] [public.]name`. These are **lexical** indicators, not a complete parser or historical provenance proof.

## Totals
- 74 current tables in scope
- 53 mentioned in migration text
- 44 have conventional CREATE TABLE detected
- 9 mentioned but have no conventional CREATE TABLE detected
- 21 not mentioned by literal name

## Nine referenced without detected creation
| Table | Migration mentions | First mention |
|---|---:|---|
| bs_race_entries | 39 | 20260819205938 |
| bs_race_events | 35 | 20260819205938 |
| bs_race_result_entries | 1 | 20260819205938 |
| bs_race_results | 27 | 20260819205938 |
| bs_ai_predictions | 9 | 20260821040234 |
| bs_member_notification_preferences | 2 | 20260830184310 |
| bs_ai_bet_results | 1 | 20260901214227 |
| bs_news_candidates | 1 | 20260903162034 |
| bsc_results | 2 | 20260912200945 |

## Interpretation
A multi-object bootstrap gap is more likely than a single missing table. Do not assume all nine objects existed at the start: some may be created by other SQL mechanisms, manual operations, restores, other repositories, or dynamic SQL. Likewise, the 21 never-mentioned current tables could have appeared after the recorded migration series. Historical schema and version-aware columns must be recovered before executable bootstrap.

## Execution gates
No production writes, Cron edits, branch creation, migration replay, or PR #297 modifications. Next steps: obtain nonsecret schema-only inventory for all prerequisite objects, identify original bootstrap source and test staged replay in an offline disposable PostgreSQL environment.
