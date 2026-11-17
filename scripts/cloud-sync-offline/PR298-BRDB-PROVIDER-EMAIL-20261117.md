# PR #298 — Provider identification confirmed by user-supplied email screenshot

Date: 2026-11-17. Screenshot shows a message from team-nave support (dated Nov 11), subject 「BRDB-APIのご利用について」.

## Provider instructions, accurately scoped
- **Provider:** team-nave **BRDB-API**.
- The example SQL is `SELECT * FROM RACEDTL WHERE OPDT = '20261111' ORDER BY RCOURSECD, RNO, TEINO`.
- Provider asks that SQL be revised following **Q011** of their BRDB-API help Q&A: `https://www.team-nave.com/system/jp/products/brdbapi/help_qa.html`.
- Provider states data is updated **twice daily (morning and night)** and asks user to stop **high-volume polling every five minutes**.
- Provider does **not** state that all BRDB-API use is banned, nor expressly prescribe an exact replacement polling interval.
- User reports stopping the Windows Task Scheduler in response. **Do not restart** it or migrate the same frequent BRDB-API requests to cloud.

## Distinguish independent sources
- Production `bs_sync_openapi_today()` calls `https://boatraceopenapi.github.io/api/v1/today.json`, which is **not** the BRDB-API endpoint named in the email.
- The BRDB-API email does not establish a polling restriction for the separate OpenAPI endpoint. Its own terms must be reviewed independently.
- The Nov 13 persisted program-row disappearance is temporally consistent with the Windows job shutdown, but direct causation requires inspecting the Windows job's code/logs and database writer.

## Release gate
1. Inspect Q011 and document the required SQL query pattern.
2. Inventory the Windows job's BRDB-API SQL and its Supabase write targets offline; do not call BRDB-API for diagnosis.
3. If BRDB-API remains a data source, propose a compliant **at-most twice-daily** retrieval strategy as a conservative design target, not a provider-authorized rate, and seek provider confirmation if unclear.
4. Ensure alternative OpenAPI ingestion is independently authorized and uses source-specific caching/rate limits.
5. Keep PR Draft/HOLD pending isolated full-data validation, trigger side-effects testing, and explicit approval for any production changes.

No production mutations authorized or performed.
