# PR298 — verified production Ichika evaluator equivalence

Date: 2026-11-17. Read-only production query:
`SELECT pg_get_functiondef('public.evaluate_ichika_escape_surge_alerts()'::regprocedure)`.

The current production function was inspected directly. The isolated fixture
`openapi-real-ichika-evaluator.fixture.sql` recreates its **today_entries,
race_ready, qualifying, recommended and inserted** CTE structure and all
qualification, ranking and deduplication predicates using disposable
`pr298_real_*` tables. Differences: the fixture adds a per-call instrumentation
insert and returns the number of alerts inserted; its table names, constraints
and indexes are simplified. Production function has `SET search_path TO public`.

Production evaluation is invoked by the row trigger
`trg_ichika_escape_surge_on_exhibition_update` on today's entries, including
INSERTs before exhibition values exist. The fixture verifies 864 initial
calls with zero false alerts, six complete exhibition values producing one
alert, a replay producing no duplicate alert, and conflict-safe re-insertion
producing zero new evaluator calls.

GitHub Actions commit c78b6420:
- offline contract run 44094751334: PASS
- PostgreSQL fixture run 44094751253: PASS

Earlier fixture run 44091800912 recorded 864 initial evaluations over
144 races in 1603.0 ms on GitHub-hosted disposable PostgreSQL. This is not
a production benchmark. No notifications, concurrent writers, production
RLS, or actual provider payloads were tested.

**Decision: KEEP DRAFT / HOLD.** A direct production function read confirms
logical equivalence of the copied query but does not establish end-to-end
cloud cutover safety, provider data rights or external feed completeness.
