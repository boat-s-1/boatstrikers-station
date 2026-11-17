# Isolated result reconciliation test — 2026-11-17 JST

Created disposable development branch `pr298-result-reconcile-test-20261117` (`ribecxvqxqoqkbflmywu`) under prior user authorization at US$0.01344/hour, applied six-table schema candidate to the branch. Initial transient DB connection refusal resolved after branch reached FUNCTIONS_DEPLOYED.

Bootstrapped synthetic 2020-01-02 course 24 race 12: one event, six entries. Inserted a synthetic confirmed/finished result with trifecta 1-2-3, payout 1230 and source isolated_fixture. Ran `ISOLATED-RESULT-RECONCILIATION-FIXTURE.sql`: success. Readback: event finished, result_available=true, trifecta=1-2-3, payout=1230, result_source/payout_source=isolated_fixture, six entries. Re-running the fixture failed with `event precondition failed: 1, 0` as intended; no second update.

This is one synthetic completed result only. Incomplete/cancelled result, conflicting provenance, theory settlement side effects, complete archive and production API path still require validation. No production write, merge or deployment. Deleted the branch and verified it is absent from the branch list. Final bill not yet available.
