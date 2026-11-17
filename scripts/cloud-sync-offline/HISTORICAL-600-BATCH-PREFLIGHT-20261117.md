# Historical 600-race batch read-only preflight — 2026-11-17 JST

Production SELECT for 2026-11-13 through 2026-11-16, restricted to result keys missing race events:

| Check | Count |
|---|---:|
| Target results / distinct keys | 600 / 600 |
| confirmed + finished + trifecta and payout present | 600 |
| status mismatch / missing result | 0 / 0 |
| null result source | 0 |
| existing race entries | 0 |
| theory recommendations / Ichika alerts | 0 / 0 |
| first-seen records | 600 |

All 600 first-seen rows are data_kind=result, source=boatraceopenapi/v1. Preserve these timestamps and records when bootstrapping program data. The 600 result records do not themselves prove that six entry rows exist in the historical archive; archive input still requires a fresh key and six-boat check before any batch load.

This preflight supports an isolated batch test, not production backfill. Repeat immediately before any eventual production transaction because the live database can change.
