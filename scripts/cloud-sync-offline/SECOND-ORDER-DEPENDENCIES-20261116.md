# Second-order function dependency audit — 2026-11-16

Production SELECT-only `pg_get_functiondef` inspection.

## Confirmed behavior
- `bs_merge_exhibition_payload(old,new,now)`: STABLE PL/pgSQL merge function, invoked by `bs_guard_exhibition_write`. It enforces source priority (official 400, PC-KYOTEI 300, boaters 200, API 100), rejects stale exhibition data, and preserves old valid values when incoming data is invalid or lower priority. No direct INSERT/UPDATE in the inspected function.
- `bs_record_first_seen(...)`: INSERT/UPSERT into `bs_source_first_seen` using `least(existing.first_seen_at, excluded.first_seen_at)`. This is a secondary write path for exhibition timestamp updates.
- `evaluate_ichika_escape_surge_alerts()`: scans **current Japan-local date** race entries, requires six exhibition and lap pairs, then inserts qualifying alerts into `bs_ichika_escape_surge_alerts` with `ON CONFLICT DO NOTHING`. Called from today's entry trigger.
- `bs_settle_theory_recommendation(id)`: SECURITY DEFINER; updates `bs_theory_recommendations` with hit, payout, profit, recovery, and settled status based on event trifecta. The caller trigger checks `new.trifecta is not null`.

## Additional schema dependencies
- `bs_source_first_seen`
- `bs_ichika_escape_surge_alerts`
- `bs_theory_recommendations`
- Functions listed above and their referenced fields

## Implications
1. Replaying a simplified core schema is not sufficient for production-equivalent trigger tests.
2. Do not suppress these triggers in a claimed production-fidelity test.
3. For 2026-11-13 through 2026-11-16 historical bootstrap, the current-date branch is not expected to fire on 2026-11-16 after the date changes; date-dependent behavior must be evaluated using the actual test execution date. In particular **Nov 16 is today during this investigation** and could fire the alert evaluator if inserted on that day.
4. A historical program archive cannot be treated as a prospective TRINITY snapshot.
5. No production writes or paid branches were created in this phase.

## Next step
Build a schema-only dependency closure, with verified function bodies, RLS and grants; test 1 race/6 entries in a genuinely isolated database before any bulk insert.
