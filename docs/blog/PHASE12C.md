# PHASE 12C — BLOG operations before production

Scope: `boatstrikers-blog-staging` (`usieipnicxzzwgrzngtt`), branch `feature/blog-media-platform`, Vercel Preview only. No production migration, environment edit, main merge or production-data copy is authorized or performed.

## Scheduler

Vercel Cron calls production deployments; it cannot validate this Preview. The existing `vercel.json` contains race/sync jobs and is unchanged. BLOG uses Supabase Cron (`pg_cron`) to call the existing `blog_publish_due(20)` transaction locally once per minute. Job: `blog-staging-publish-due`, ID 1. Only this staging DB has been configured. The repeatable operational setup is `ops/blog/staging-cron.sql`, guarded by a staging-only tag ID. It is deliberately outside automatic migrations.

The command begins a transaction, sets the local role to `service_role`, applies a 30-second statement timeout and invokes the BLOG-only function. No HTTP worker endpoint, API token, public key, service key or new secret is added. No Vercel environment variable is changed. Postgres handles the internal job connection. Existing credentials remain server-only and environment-specific.

## Live automatic test

Acceptance article: `phase12c-auto-schedule-check`, post ID `4bd9d66b-dfeb-474d-8600-f90ff9a01e3b`, reserved sealed snapshot `8c743cdc-23e7-4aa1-b311-32b9cce612cc`.
Created at 2026-10-04 18:30:49.793 JST; reserved for 18:36:49.793 JST (six minutes later). No privileged manual worker invocation is used for this article. Before due, public search/list exclude it and the direct URL returns 404. Preview robots/noindex/Sitemap isolation remains enabled even when staging articles are published.

The periodic run at 18:37:00.019779 JST promoted the exact reserved snapshot; the transaction ended at 18:37:00.040495. Observed scheduling delay: 10.23 seconds. Public list and search contain the article and its direct URL returns 200. At 18:38 and 18:39 the same worker ran again successfully; both verification articles still had exactly one revision and one `scheduled_publish` event. Nothing was re-published or duplicated.

Using actual staging data read under the anon role, the production Sitemap builder includes this due/indexable article and excludes the separate noindex retry article. The live Preview Sitemap correctly includes neither. Isolated BLOG tests: 89 pass, 0 fail, 12 optional HTTP tests skipped; live Preview endpoints were checked separately. The security advisor reports only the two pre-existing INFO notices for deliberately inaccessible templates/publication events, with no new warning/error.

## Failure/retry and duplicate safety

Separate article `phase12c-retry-check`: a dedicated verification author was temporarily disabled after reservation. At 18:34:00 JST the scheduled job failed with `BLOG_NOT_PUBLISHABLE`. The article remained draft, reserved snapshot and timestamp remained, and scheduled-publication event count stayed zero. After restoring that author, the next periodic job at 18:35:00 JST published the same reserved snapshot, with exactly one scheduled-publication event. No manual worker call was used to recover it.

`FOR UPDATE SKIP LOCKED` protects competing workers. Promotion clears the reserved pointer atomically with event creation. Later invocations find no reservation to publish again. The isolated Postgres test additionally checks that failure after an earlier row rolls back the whole batch, retry promotes both reservations, and another invocation adds no events. A permanent invalid reservation can block its batch until corrected/cancelled; failures are not silently ignored.

## Timing and monitoring

Interval: one minute; batch limit: 20 articles; statement timeout: 30 seconds. With a healthy DB and no backlog, scheduling wait is less than approximately 60 seconds, plus processing. This is not an unconditional maximum-delay SLA: DB outage, timeout, permanent validation failure or backlog can extend it. Never claim publication time equals the cron start precisely.

Dashboard: staging project → Integrations → Cron → `blog-staging-publish-due` → History.

```sql
select runid,status,return_message,start_time,end_time
from cron.job_run_details
where jobid=(select jobid from cron.job where jobname='blog-staging-publish-due')
order by runid desc limit 30;

select id,slug,scheduled_at,scheduled_revision_id
from public.blog_posts
where scheduled_revision_id is not null and scheduled_at<=now()
order by scheduled_at;
```

Inspect failed runs and overdue reservations. Correct the underlying issue or cancel/recreate the reservation through the administrator UI. The next cron tick retries; it does not manufacture new article content. Do not alter sealed snapshots directly. Set a log-retention/alerting policy before long-term operations; no external notification service is added.

## Worker access

Actual staging `anon` and `authenticated` calls to `blog_publish_due` are rejected with SQLSTATE 42501. Neither has Cron-schema usage. The function remains SECURITY INVOKER and only privileged server/DB roles can execute it. No `NEXT_PUBLIC_` secret is introduced. Verify these grants again on production before activating any scheduler.

## Production GA checklist (not executed)

- BLOG → Today/RACE: `blog_to_race`.
- BLOG → 一果: `blog_to_character`, `character=ichika`.
- BLOG → 初音: `blog_to_character`, `character=hatsune`.
- BLOG → キイナ: `blog_to_character`, `character=kiina`.
- RACE → BLOG: `race_to_blog`.
- Confirm `source_page`, `destination_page`, `placement`, `source_kind` in the existing GA setup; confirm each click sends once and appears in GA Realtime/available debug tools.
- Preview sends none of these events by design. Production GA reception remains unverified.

## Production SEO checklist (not executed)

- Approved published/due/indexable article: index allowed; drafts, reservations, private editor Preview and search stay noindex.
- Canonical uses `https://www.boat-strike.online/blog/articles/[slug]`; published slugs stay fixed.
- Article OGP references the selected public image; anonymous retrieval succeeds. Fallback works; draft/unused/unpublished images stay denied.
- Live HTML contains BlogPosting and BreadcrumbList with real published/modified times, editorial author identity, category/tags. No fictitious human qualifications or NewsArticle for non-news content.
- `/sitemap.xml` includes only published, due, indexable snapshots; excludes fixtures, searches and noindex articles. Tags require the existing opt-in editorial policy.
- `/robots.txt` permits intended production crawling while protecting admin/API paths. Never transfer Preview's blanket disallow to production.
- Preview continues noindex, blanket disallow and omission of article structured data/BLOG Sitemap entries.

## Authorized production procedure — preparation only

1. Confirm a successful production Supabase backup and restore procedure; record the pre-release production deployment ID and settings.
2. Review only BLOG migrations `20261002141712_blog_media_platform.sql` and `20261003174612_blog_private_media_publication.sql`, plus grants/functions. Do not blindly push the entire repository migration directory.
3. After separate approval, apply those BLOG migrations to the verified production project. Do not import staging records or Storage objects.
4. Check every BLOG table's RLS and anon restrictions; worker execution remains denied to anon/authenticated; run security advisors.
5. Create a production-only private BLOG Storage bucket: 8MiB, JPEG/PNG/WebP, no public bucket and no anon direct-object policy. Verify image publication gates.
6. Set production-specific BLOG URL/key/private-bucket variables deliberately; service key stays server-only. Keep `BLOG_DB_WRITES_ENABLED=false` initially. Never reuse staging or race-production secrets for the BLOG staging environment.
7. Prepare a separate production DB Cron named `blog-production-publish-due`, same BLOG-only command/interval. Create it inactive. Do not use the staging setup script or duplicate scheduling in Vercel. Activate only after the approved Production deployment and write smoke tests are ready.
8. Create a PR from `feature/blog-media-platform` to main with tests/operational review.
9. Perform final Preview verification and obtain release authorization.
10. Merge only after authorization.
11. Verify Production deployment is READY, BLOG reads only the intended production DB, legacy RACE/member functions remain normal, and Preview fixtures stay absent. Enable BLOG writes, then activate the dedicated Cron when ready.
12. Create a new real production article as a draft; verify save/autosave/reload. Do not copy these staging test articles.
13. Publish approved real content, verify public/edit isolation and media gates; perform a future reservation smoke test through the dedicated Cron.
14. Execute the production SEO checklist.
15. Execute the production GA checklist. Record results before declaring production verification complete.

## Rollback — preparation only

1. Verify the production project, then stop only its BLOG Cron reversibly:
   `select cron.alter_job((select jobid from cron.job where jobname='blog-production-publish-due'), active:=false);`
   Verify `cron.job.active=false`; check a tick already in progress before assuming it stopped.
2. Disable `BLOG_DB_WRITES_ENABLED` for the affected environment, redeploy and verify admin writes fail closed. In an urgent incident, additionally revoke execution of BLOG write RPCs from `service_role` in a reviewed transaction (BLOG functions only); this preserves DB data and blocks old deployments while redeploying. Do not revoke race functions or change shared race credentials.
3. Roll back Vercel to the recorded pre-release stable deployment. Recheck RACE, member and administrator routes.
4. Keep BLOG tables, immutable snapshots, events and private Storage. Do not DROP migrations/tables, disable RLS or make Storage public to get the site working.
5. Restore DB backup only when required for actual data damage, using a reviewed recovery plan. Prefer restoring to a recovery environment and recovering BLOG data selectively; a full production restore can roll back unrelated race/member data. Coordinate that impact explicitly before executing it.
6. Verify public BLOG visibility/media policies and keep Cron/writes off until the repaired release is approved. Record every rollback action. No rollback command was executed on production.

## Remaining operational decisions

Production activation, real-domain SEO, GA reception, long-term job-history retention/alerting and behavior under backlog/outage require final operational sign-off. All verification data remains staging-only. Tests and staging setup are committed on the feature branch; no application feature or prediction logic is added.
