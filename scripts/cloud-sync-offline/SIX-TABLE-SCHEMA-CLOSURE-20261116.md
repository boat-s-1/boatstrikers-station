# Six-table schema closure and alert-to-recommendation chain — 2026-11-16

Read-only production catalog and function-body inspection.

| Table | Columns | Constraints | Triggers | Indexes | RLS |
|---|---:|---:|---:|---:|---|
| bs_race_events | 56 | 6 | 2 | 6 | on |
| bs_race_entries | 107 | 7 | 6 | 10 | on |
| bs_race_results | 18 | 2 | 1 | 3 | on |
| bs_source_first_seen | 8 | 4 | 0 | 3 | on |
| bs_ichika_escape_surge_alerts | 18 | 5 | 1 | 4 | on |
| bs_theory_recommendations | 27 | 2 | 0 | 4 | on |
| **Total** | **234** | **26** | **10** | **30** | |

The six tables are a **minimum known dependency set**, not proof of complete closure.

## Newly verified chain
`bs_race_entries` INSERT on current JST date -> `trigger_evaluate_ichika_escape_surge_alerts` -> `evaluate_ichika_escape_surge_alerts()` -> conditional INSERT into `bs_ichika_escape_surge_alerts` -> AFTER INSERT `trg_capture_ichika_escape_surge_recommendation` -> SECURITY DEFINER `bs_capture_theory_recommendation()` -> UPSERT `bs_theory_recommendations` -> SECURITY DEFINER `bs_settle_theory_recommendation()`.

This chain can create recommendations, not just alerts. The alert evaluator requires six exhibition/lap measurements and only considers current JST date. Initial bootstrap may not provide exhibition measurements, but existing current-day rows and later updates can satisfy conditions.

## Constraints in secondary tables
- `bs_source_first_seen`: unique `(race_date,course_code,race_no,data_kind,source)`; kind in `exhibition,result,ai`.
- `bs_ichika_escape_surge_alerts`: unique race key; recommended_second_boat 2..6 when non-null.
- `bs_theory_recommendations`: unique `(source_table,source_alert_id)`.

## Safety gate
- Never treat a passing insert-only fixture as sufficient without verifying the alert/recommendation side-effect chain.
- Do not use a current-date fixture for the first isolated smoke test.
- Include secondary tables in schema-only baseline and before/after state assertions.
- No production writes or paid environment were used.
