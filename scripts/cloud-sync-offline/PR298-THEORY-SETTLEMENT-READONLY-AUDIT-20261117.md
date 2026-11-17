# PR #298 — Theory settlement production read-only audit

Audit date: 2026-11-17. Production queries were SELECT-only. No recommendation records, functions, triggers or schedules were modified.

## Checks

From `public.bs_theory_recommendations` with `status='settled'`:

| Check | Count |
|---|---:|
| Settled recommendations | 1,701 |
| Settled with `is_hit=true` | 373 |
| Hit and `trifecta_payout IS NULL` | 0 |
| Hit and `payout=0` | 0 |
| Hit and `trifecta_payout=0` | 0 |

Compared every settled recommendation against `bs_race_events` using `race_date, course_code, race_no`:

| Check | Count |
|---|---:|
| Mismatched trifecta payout (including NULL differences) | 0 |
| Missing event trifecta | 0 |
| Missing event payout | 0 |
| Mismatched trifecta after normalizing hyphen formatting | 0 |

**Normalization is essential.** Event trifecta is commonly stored as `123`, while settled result combination can be `1-2-3`. Raw text comparison produced 1,447 apparent differences, which were formatting differences, not substantive disagreements. A separate regex-based exploratory comparison also gave 132 apparent mismatches due to inconsistent format handling; the final authoritative check used `replace(trim(value),'-','')` on **both** sides and returned zero.

## Limits

- These checks examine currently persisted data, not historical transitions, settlement trigger execution order, or off-database notifications.
- `bs_settle_theory_recommendation` still calculates winning payout using `coalesce(ev.trifecta_payout,0)` and the event trigger can fire on trifecta alone. The candidate's preflight rejects incoming trifecta without payout, but legacy writers can still create incomplete events.
- This audit does not verify the correctness of ticket JSON, investments, rounding, source rights, race result provenance or eventual official corrections.
- No production repair is indicated by these particular checks; do not claim all historical settlements are correct.

## Decision

Keep PR #298 in Draft/HOLD pending end-to-end trigger fixture, writer coordination, real upstream payload, licensing, migration drift reconciliation and approved cutover.
