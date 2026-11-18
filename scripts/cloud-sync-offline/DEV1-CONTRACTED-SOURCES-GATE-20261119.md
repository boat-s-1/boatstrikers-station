# Development ① — contracted sources and cloud cutover gate (2026-11-19 JST)

## Evidence and use

| Source | Verified capability | Intended role | Remaining gate |
|---|---|---|---|
| Team-Nave BRDB-API | HTTPS request/CSV response; cross-platform; RACEDTL Q011; twice-daily morning/night refresh | Previous-day race program batch and historical backfill candidate | Confirm one-device license cutover, server-side storage/publication rights, actual API credential transport, full table/field mapping, and provider-approved request cadence |
| PC-KYOTEI Database | Windows application; paid auto-update stores real-time results and pre-race information in PostgreSQL; original exhibition times in brd_c4, earliest 12 minutes before deadline, sometimes later | Existing field-level comparison baseline only | Confirm export/redistribution rights and replacement for all unique exhibition fields; no demonstrated cloud-native client |
| Official beforeinfo candidate | One approved small observation is scheduled separately | Standard preview at deadline minus ten minutes candidate | Verify actual publication timing, six-boat identity, field parity, terms, rate budget, and end-to-end measured latency |

BRDB documentation: https://www.team-nave.com/system/jp/products/brdbapi/help_dbaccess.html ; https://www.team-nave.com/system/jp/products/brdbapi/help_qa.html ; https://www.team-nave.com/system/jp/products/brdbapi/help_limit.html . PC-KYOTEI documentation: https://pc-kyotei.com/manual-menu/ ; https://pc-kyotei.com/realtime-data/ ; https://pc-kyotei.com/originaltenjitime/ . Provider email from November 11 is summarized in `PR298-BRDB-PROVIDER-EMAIL-20261117.md`.

## Offline implementation and release sequence

`brdb-q011-query.mjs` constructs the provider's indexed query shape for a strictly validated target date, including the ten-day meeting-start bound. It performs no network I/O. It is a candidate, not a credential-bearing client or approved schedule. No requests to BRDB or PC-KYOTEI are part of this work.

1. Confirm BRDB terms and device cutover with provider. Locate the old Windows extraction script/SQL offline and map its program and result columns. Never run two devices under the same license simultaneously.
2. Stage a single cloud fetcher without production credentials; inspect one permitted sample against the official meeting list and six registration numbers per race. Reject missing, duplicated, cancelled/mismatched or stale races; preserve provenance and stronger existing rows.
3. Save a complete preceding-day program only after independent manifest/roster parity and transaction rollback/replay tests. Schedule no more frequently than the provider confirms; avoid its 06:00–08:00 maintenance period. The provider's twice-daily *data update* is not an authorized polling limit.
4. Treat PC-KYOTEI's `brd_c3`/`brd_c4` fields separately from standard preview. A publication later than deadline minus ten minutes must be reported as late/unavailable, never fabricated. Confirm whether the original exhibition fields can be sourced and stored independently in the cloud.
5. Only after isolated testing and explicit production approval, cut over the unique writer, verify site display and measured daily freshness, monitor failures, and define rollback. No production DB/Cron/Vercel changes or existing PR merge here.

## Current status

The provider contracts make cloud program ingestion plausible. They do not establish live credential access, rights to republish, the promised ten-minute preview, or a completed Windows-free cutover. Draft/HOLD.
