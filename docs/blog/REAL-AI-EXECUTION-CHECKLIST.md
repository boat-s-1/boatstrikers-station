# Execution checklist — real execution remains HOLD

- [ ] Official input/output model prices and USD/JPY independently verified; sources and timestamp recorded (not mock rates).
- [ ] Fixed model gpt-6.1-terra, input/output bounds, margin, 1,000 JPY reference and 700 JPY operating limit accepted.
- [ ] Persistent stateDir and remaining reservations reviewed; total new reservation fits the remaining 700 JPY pool.
- [ ] Unique external output directory and exact plan/source fingerprint reviewed.
- [ ] Node24 loopback proxy mock test and offline safety/quality tests pass.
- [ ] Current HTTP secret readiness and enforced outbound policy checked without revealing values.
- [ ] User explicitly authorizes the real run (not merely implementation or approval creation).
- [ ] One-use local approval issued within one hour; no changes to plan/code/data after issue.
- [ ] Smoke confirmation, then 一果 confirmation, then 初音 confirmation, then キイナ confirmation, only while prior stages pass.
- [ ] Any failure/cancellation/unknown usage ends execution. No retry, fallback model or regenerated article.
- [ ] External report reviewed; ledger and consumed approval preserved. No publication or database write.

These boxes are intentionally unchecked. Successful offline tests do not authorize an actual request or demonstrate provider credential/model/billing access.
