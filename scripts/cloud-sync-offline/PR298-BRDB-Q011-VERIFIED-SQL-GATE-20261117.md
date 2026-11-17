# PR #298 — BRDB Q011 official SQL findings and compliance gate

Verified 2026-11-17 from Team-Nave official Q&A:
https://www.team-nave.com/system/jp/products/brdbapi/help_qa.html

## Official facts
- Q009: dataset is updated **twice per day, morning and night**.
- Q011: `RACEDTL` is large; `OPDT` alone is not indexed as primary/secondary key for efficient extraction. Provider explicitly identifies `WHERE OPDT='20260101'` alone as a harmful query.
- Official positive example: `SELECT * FROM RACEDTL WHERE SOPDT >= '20251222' AND OPDT = '20260101';`
- Provider recommends specifying start date `SOPDT` about ten days before the target date to cover multi-day meetings. Joins must also consider primary/secondary keys.
- User's November 11 provider email specifically identified `SELECT * FROM RACEDTL WHERE OPDT='20261111' ORDER BY RCOURSECD, RNO, TEINO` and requested Q011 correction and cessation of high-volume five-minute access.

## Proposed query shape (NOT EXECUTED)
For a target date D, calculate D-10 calendar days and construct a parameterized, provider-compatible query:

```sql
SELECT *
FROM RACEDTL
WHERE SOPDT >= :start_date_yyyymmdd
  AND OPDT = :target_date_yyyymmdd
ORDER BY RCOURSECD, RNO, TEINO;
```

The placeholders are *illustrative* and may not match BRDB-API's actual parameter-binding syntax. Confirm supported SQL dialect, quoting, actual task implementation, and all other RACEDTL queries before any deployment. This does **not** authorize a new polling schedule; explicit provider confirmation of rate/rights is still needed.

## Separate-source policy
- BRDB provider request concerns BRDB only. It does not prove OpenAPI's allowed polling cadence.
- Do not equate PC-KYOTEI data export rights with BRDB rights.
- Do not restart Windows v7, run a live BRDB query, or move five-minute polling to cloud.

## Status
Read-only external documentation verification and GitHub documentation only. Production, cron, Vercel unchanged. Draft/HOLD.
