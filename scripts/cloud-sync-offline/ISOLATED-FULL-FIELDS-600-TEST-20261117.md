# Full-field archive bootstrap in isolation — 2026-11-17 JST

Reused the four newly fetched historical program archives. Checked 3,600 racer objects: all have non-null number, name, rank source, national/local win rates, national/local top-two percentages, average start timing, F/L counts, motor/boat numbers and top-two percentages, and weight. Mapped these to the existing `app/api/live/openapi-preview/route.js` bootstrap payload field names. The earlier 600-race test had only identifier/name fields; this test supplied all bootstrap racer fields.

Created disposable branch `pr298-full-fields-600-test-20261117` (`nrpjufsynwqxitkmqpkk`), applied six-table schema candidate, invoked bootstrap with 600 events and 3,600 full-field entries. RPC returned 600 event and 3,600 entry inserts. Readback: 3,600 entries; 3,600 with all 15 checked saved racer fields non-null; 3,600 with BOATRACE_OPEN_API_BOOTSTRAP provenance. Deleted branch and confirmed absence. No production write, merge or deployment. Final billed amount unavailable.

This does not verify field-by-field numeric equality against source, BRDB parity, canceled races, existing result/first-seen preservation, or 600-row completed-result reconciliation. The source is an unofficial archive.
