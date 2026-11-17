# 初音Cron — Vercel 60秒強制終了の実証 (2026-11-17)

## Read-only evidence
Vercel project `prj_iKWrqS29BRLCIWKHoDe1SFOTH8Y2`, team `team_rNunZeEWQozAOqhFtLVQ1d0v`, runtime-errors query scoped to route `/api/cron/hatsune-news-pipeline`, 7-day requested window:
- Error group: **Vercel Runtime Timeout Error: Task timed out after 60 seconds**.
- Group count reported: 7.
- Latest occurrence: 2026-11-17T01:00:00Z = 2026-11-17 10:00 JST.
- The returned group includes an older first-seen timestamp (2026-08-28), so the group count should not be treated as a verified 7-day event count without independent evidence.

Production Supabase `hatsune_news_cron_runs`, read-only:
- 2026-11-17 10:00 JST record remains `running`.
- Within the last 21 days, 35 `running` records have no `finished_at`.
- 28 `partial` records have mean duration ~56 seconds and maximum ~59.2 seconds, with 19 at >=55 seconds.

## Interpretation
A **real** Vercel 60-second timeout occurred on the same route and same 10:00 JST slot as a stranded `running` record. This is strong evidence that runtime termination can cause missing completion logs. It does not establish that all 35 stranded rows share this cause; logging update errors remain possible.

An attempted grouped runtime-log query over seven days timed out at the observability endpoint; no additional individual log messages were retrieved.

## Guardrails
- No production edits, runtime increase, Cron reschedule, retry, republish or external source fetch.
- Avoid returning raw logs, request headers, secrets, news contents, or identifying data.
- Proposed separate reviewed production patch should prioritize bounded stage timings, deadline awareness, and safe log persistence; changing 60-second limit alone may increase cost or merely postpone the failure.
