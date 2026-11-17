# PR #301 — review and release boundary (2026-11-17)

## Verified
- Production source before change: `finishHatsuneCronRun` awaited a PostgREST `.update(...).eq(...)` without checking its returned `error` or whether any row matched.
- This PR uses `.select("id").maybeSingle()` to distinguish an updated row from a missing row, logs only bounded error code and a generic job label, and does not retry.
- Offline Node contract and stateful-mock tests pass.
- Disposable PostgreSQL 17 job passes UPDATE RETURNING, no-match, permission-denial, and transaction ROLLBACK assertions. It is **not** a PostgREST/Supabase client integration test.
- The handler remains a **write** endpoint. Never invoke GET /api/cron/hatsune-news-pipeline as a health probe.

## Important limitations
- The modification adds a representation-returning update (`RETURNING id` / PostgREST select). Real Supabase API and RLS/role permissions must be reviewed before merging. In particular, SELECT permission is needed for representation; this is not yet validated against the actual deployed role.
- If the HTTP request is terminated before `finishHatsuneCronRun`, the row remains running. This fix does not address the 60-second handler timeout or the BOAT RACE listing's 3.5-second fetch timeout.
- A successful response from `finishHatsuneCronRun` only confirms that the completion row update was acknowledged; it is not proof all pipeline side effects committed.
- This change preserves existing behavior for returned PostgREST errors by logging rather than throwing. Unexpected thrown transport failures still propagate as before.
- Current catch branch in the pipeline also awaits `finishHatsuneCronRun`. A thrown transport failure there can supersede the original pipeline exception; unchanged by this PR.
- Logging must not include credentials, request headers, article bodies, raw DB error messages, or personally identifying fields.

## Required before release
1. Review PostgREST `.select().maybeSingle()` compatibility with installed supabase-js and deployed `hatsune_news_cron_runs` permissions in a safe isolated environment.
2. Review the complete diff and CI results, including the unrelated repository checks.
3. Obtain explicit approval for merge and deployment; perform rollback planning. Do not auto-replay prior `running` or `partial` jobs.
4. Treat timeout root cause and production observability as separate follow-up changes.

**Status: DRAFT / HOLD. No production writes, deploy, merge, Cron trigger, or paid Supabase branch performed.**
