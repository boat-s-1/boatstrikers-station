# PR #298 — V3 unified SQL body execution (read-only)

Executed the CTE/UNION body from `completeness-v3-unified-quality-rows.candidate.sql` directly as a SELECT on production data for 2026-11-13. **No CREATE FUNCTION, INSERT, UPDATE, NOTIFY, or cron action.**

Result:
- unified_races: 156
- issues: 156
- missing_base: 156
- missing_entries: 156

This verifies SQL body parses and executes on the current production schema for the tested date. It does **not** verify CREATE FUNCTION return-type validation, SECURITY INVOKER role permissions, or the candidate recorder's real side effects. Run the exact candidate CREATE FUNCTION scripts and 14-case lifecycle tests only on an isolated database.

Additional caution: the existing V2 recorder's resolution query uses only event-anchored quality rows, so V2 and V3 must not run against the same day concurrently. Do not enable a V3 scheduler until coordinated cutover is verified.
