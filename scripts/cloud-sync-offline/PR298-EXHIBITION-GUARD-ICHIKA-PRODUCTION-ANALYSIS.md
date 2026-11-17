# PR298 — Actual exhibition guard and Ichika evaluator analysis

Read-only inspection of production function definitions on 2026-11-17.
No functions were executed.

## Exhibition merge guard
`bs_guard_exhibition_write()` delegates to
`bs_merge_exhibition_payload(old,new,clock_timestamp())`.
The merge checks race/boat/racer identity and maintains per-field provenance.
Source precedence in the actual function is:
- official 400
- PC-KYOTEI 300
- boaters 200
- API 100
- other 0

Valid values and timestamp freshness are checked before accepting a
replacement. When the incoming payload is all-null or unchanged, the
existing source and sync clock are preserved. This is stronger than a
simple last-write-wins policy, but requires a **real fixture with the
production function** before declaring the candidate safe.

## Ichika trigger and evaluator
`trg_ichika_escape_surge_on_exhibition_update` is an AFTER INSERT or
UPDATE OF exhibition/lap fields **per row**. It invokes the evaluator
on current-JST-date rows. The evaluator scans the day's entries,
requires six complete exhibition and lap values per race, and inserts
qualified alerts with
`ON CONFLICT (race_date,course_code,race_no) DO NOTHING`.

Consequences:
1. A six-boat bootstrap INSERT invokes the evaluator six times even
   without exhibition values. It should insert no alert for incomplete
   races, but the scans still cost work.
2. A new day's bulk bootstrap can repeatedly scan all of today's
   entries, potentially creating significant load; performance has
   **not** been measured in production.
3. Duplicate alert records are constrained by conflict handling, but
   this does not prove no downstream notifications are duplicated.
4. Replays with `ON CONFLICT DO NOTHING` do not execute INSERT triggers
   for existing rows; UPDATEs of monitored columns can re-evaluate
   even when values do not change.
5. The evaluator is a database writer; never call it during read-only
   diagnosis.

## Next release gates
- Run the exact production guard/evaluator bodies in an isolated
  PostgreSQL environment with representative current-day volumes.
- Verify zero spurious alerts on program-only bootstrap, source-priority
  preservation and rollback.
- Measure fan-out runtime at a full day of races and compare with Cron
  interval; do not infer acceptable latency from a six-boat fixture.
- Verify alert notification side effects separately from database
  uniqueness before cutover.
- Do not install/modify production functions, triggers or Cron without
  explicit approval.
