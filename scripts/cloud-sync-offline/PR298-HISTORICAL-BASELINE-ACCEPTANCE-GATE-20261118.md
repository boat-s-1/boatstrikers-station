# PR298 — historical schema provenance decision gate (2026-11-18)

## Verified

- Production stored migration history begins at `20260819205859`; its first migration describes adding new AI V2 tables while leaving existing production structures unchanged.
- A read-only inspection of the earliest 12 stored migrations shows references to `bs_race_events`, `bs_race_entries`, and `bs_race_results`, but no direct CREATE TABLE for these three.
- Repository-wide CI SQL inventory scanned 142 SQL files and found four direct CREATE TABLE files per core table; these are current review candidates and test fixtures, not proven pre-August genesis migrations.
- GitHub commit-message search for `schema`, `bootstrap`, `initial`, `migration`, and `bs_race_events` did not establish a version-correct pre-2026-08-19 genesis baseline. Search is **not** a complete repository history audit.
- CI for commit `de226cd23c5e74022f0cbbf8873034fb70307f1a`: offline contract #354 PASS; PostgreSQL fixture #349 PASS.

## Provenance acceptance criteria

A candidate is acceptable as a historical baseline only if it has:
1. A dated source **at or before** the first stored migration (or independently verifiable equivalent historical provenance).
2. Complete dependent object coverage for the earliest replay: tables, columns, constraints, sequences, indexes, extensions, functions, triggers, roles/grants, and RLS.
3. Reproducible hash and immutable location.
4. A successful disposable database replay of baseline followed by all migrations in chronological order, with failure logs and a schema diff.
5. Isolated authorization and trigger/load tests. A test fixture passing is not sufficient.

## Decision

**HOLD**: the present six-table catalog-derived candidate is an *isolation candidate*, not a verified genesis baseline. No production changes, no paid branch recreation, no merge/cutover. Further historical evidence may come from early backup artifacts, pre-August Git tags/commits, or a dated schema-only export. Do not infer that such an artifact exists.
