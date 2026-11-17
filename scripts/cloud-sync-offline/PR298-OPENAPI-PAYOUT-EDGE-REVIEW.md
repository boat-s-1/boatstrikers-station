# PR #298 — Payout edge-case HOLD review (2026-11-17)

## Evidence from provider's published v1 schema

The provider defines `result.payouts.<kind>` as an **array**. In a dead heat
the same bet type may have more than one winning combination and payout.
The provider also documents `amount: null` and textual labels for
non-established bets. Source:
https://raw.githubusercontent.com/boatraceopenapi/api/gh-pages/docs/v1/schema.md

## Candidate implementation limitation

The current `openapi-atomic-cron-caller.candidate.sql` maps only
`{result,payouts,trifecta,0,...}`, `exacta,0`, `quinella,0`, and
`trio,0`. Its payout numeric validation likewise checks only index 0.
This is acceptable only if the target schema and business rule explicitly
define a single payout per bet type; otherwise dead-heat combinations
can be silently omitted. The same limitation may apply to legacy results
and any dependent prediction-settlement logic.

The caller also selects the first `place_number=1/2/3` result racer,
which cannot faithfully represent dead-heat finishing positions as
single `first_boat`/`second_boat`/`third_boat` fields.

## Required before production cutover

1. Determine from production **read-only schema and consumers** whether
   multiple payout combinations and dead-heat placements are representable.
2. Decide whether to store raw provider result payload and normalized
   multi-payout child records, or explicitly exclude flagged dead heats
   with an observable status. Never silently choose the first item.
3. Add a synthetic two-trifecta payout fixture and test explicit,
   documented behavior. Validate **all** array elements, not just index 0.
4. Compare real provider data and legal rights before any backfill.

**HOLD:** this is an audit finding, not a production change.
