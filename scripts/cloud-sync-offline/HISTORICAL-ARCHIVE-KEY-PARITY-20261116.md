# Historical OpenAPI recovery evidence — 2026-11-16 (read-only)

## Sources and method
- Retrieved public archive JSON from `https://boatraceopenapi.github.io/api/v1/2026/YYYYMMDD.json` for 2026-11-13 through 2026-11-16.
- Parsed `programs.stadiums.*.races.*`, including `racers`.
- Queried production Supabase `public.bs_race_results` with a SELECT of `race_date, course_code, race_no` for the same four dates.
- Compared exact sets of keys `(race_date, course_code, race_no)`. No writes, RPC calls, cron executions, or deployments.

## Verified results

| Date | Archive venues | Archive races | Racer entries | Production saved result keys |
|---|---:|---:|---:|---:|
| 2026-11-13 | 13 | 156 | 936 | 156 |
| 2026-11-14 | 14 | 168 | 1008 | 168 |
| 2026-11-15 | 13 | 156 | 936 | 156 |
| 2026-11-16 | 10 | 120 | 720 | 120 |
| Total | 50 venue-days | 600 | 3600 | 600 |

- **Exact race-key set match: true (600 / 600).**
- Production result keys missing in archive: **0**.
- Archive race keys absent from production result set: **0**.
- Duplicate keys in either set: **0**.
- Archive races with a non-six racer count: **0**.
- This does not validate the content of all 3600 racer records, official cancellation nuances, field-level BRDB parity, or the bootstrap RPC's transactional safety.

## Retrieval caveat
The extraction connector returned JSON in Markdown code blocks; on 2026-11-15 and 2026-11-16 it escaped underscores as `\\_`. These Markdown escapes were removed before JSON parsing. The 2026-11-13 and 2026-11-14 payloads parsed directly. The source URLs are public and do not invoke the application's write-capable `/api/live/openapi-preview` endpoint.

## Release gate
**HOLD** production writes until isolated Supabase tests confirm idempotency, referential integrity, rollback behavior, and preservation of existing results/payouts. This report is evidence of archive availability and key parity, not authorization to restore production.
