# BOATSTRIKERS BLOG — PHASE 1

Base: `eb99c3f81bb7278d2be691c5fe5e2fa0b205cb1b` (main).
Branch: `feature/blog-media-platform`.

## Scope and deployment gate

This phase adds BLOG-only schema, immutable publication snapshots, transactional draft saves,
server-side administrative API scaffolding, structured dialogue scenes, and the autosave state engine.
It does not create public `/blog` pages or a rendered admin editor yet.
No production database migration, storage bucket, cron, environment variable, existing article table,
TRINITY module, or prediction calculation was changed. No merge to main is authorized in this phase.

Required order: review migration -> review SQL/grants/RLS -> isolated validation -> report -> obtain
production-application confirmation. A GitHub/Vercel Preview does not provide an isolated database by itself.
Never run `supabase db push --linked` against the production project as part of Preview setup.

Migration: `supabase/migrations/20261002141712_blog_media_platform.sql`.
Created with Supabase CLI 2.119.0 `migration new blog_media_platform`.

## Tables (12)

- `blog_posts`: permanent URL identity, monotonically increasing edit version, three revision slots.
- `blog_post_revisions`: mutable editing version or sealed snapshot; content metadata/SEO/category.
- `blog_blocks`: ordered structured blocks belonging to one revision.
- `blog_authors`: three editorial characters and BoatStrikers editorial desk (seeded identities only).
- `blog_post_authors`: ordered author/coauthor association, separate from dialogue speakers.
- `blog_categories`: ten initial categories, no fabricated articles or metrics.
- `blog_tags`, `blog_post_tags`: tags associated with a revision.
- `blog_post_relations`: ordered BLOG/legacy-content references associated with a revision.
- `blog_media`: private/public asset metadata; no bucket is created in this phase.
- `blog_templates`: private editorial templates, no public read grant.
- `blog_publication_events`: private publish/schedule/cancel/unpublish history.

Only these new objects are modified. Existing table grants/default privileges are not changed.
Catalog identities can be updated centrally; article content, author assignments, tags and relations
are versioned. Published slug changes are rejected after the first publication.

## State model

`blog_posts.state`: `draft`, `published`, or `unpublished`.
Scheduling is independent: `scheduled_revision_id` plus `scheduled_at`, so a published article can
keep its current public version while a new version waits for release. The editor can then continue
with a third revision. The visible admin label will be derived from state and these slots.

1. `blog_create_draft`: creates a new post and initial edit in one transaction.
2. `blog_save_draft`: locks the post, compares `edit_version`, saves only the editing revision and
   increments the version. A new editing snapshot is created if necessary. Every block, tag, author
   and relation is saved atomically. A stale or null version is rejected (`40001` -> HTTP 409).
3. `blog_editor_document`: locks for a coherent read; prefers editing, then scheduled, then published.
4. `blog_release`: validates, seals the edit and either selects it as the public version or schedules it.
   It never silently replaces an existing reservation: cancel first. Scheduled dates must be future dates.
5. `blog_change_state`: cancels reservation or unpublishes. Cancellation keeps the scheduled content
   as a new editable copy when no edit exists; the old snapshot remains sealed.
6. `blog_publish_due`: locks due posts with `FOR UPDATE SKIP LOCKED` and promotes reserved snapshots.
   It leaves ongoing edits intact and is idempotent on repeated calls. No timer/cron is registered yet.

Triggers reject modifications/deletions of sealed revisions and changes to their blocks/authors/tags/relations.
Composite foreign keys ensure a revision slot cannot point to another article. Deferred constraints check
that public/reserved slots are sealed and the editing slot is mutable. All release mutations update the
post version too, protecting against an autosave racing a manual publication or scheduled promotion.

## Grants and RLS

All 12 tables have RLS enabled. Explicit revokes remove Supabase-style default public mutation grants.

- `anon` / `authenticated`: read active catalogs and currently public snapshots only; no write privileges.
- `blog_posts`: public column grants exclude draft/reservation pointers and internal edit-version fields.
- revisions: readable only when selected by a currently public post whose initial publication time is due.
- blocks/authors/tags/relations: readable only through the visible revision policy.
- media: public assets only; private storage paths are not included in public column grants.
- templates and publication history: intentionally no public read policy/grant.
- administrative functions: `SECURITY INVOKER`, empty explicit search path, EXECUTE revoked from
  PUBLIC/anon/authenticated and granted to service_role only. No SECURITY DEFINER function or view is added.

The existing admin uses an HMAC cookie, not a Supabase user JWT. Therefore an ordinary member is never
granted BLOG editing rights by RLS. The server validates the existing admin session before using a
server-only BLOG service client. Sensitive cookies/keys are not stored in article content.

## API and configuration

New APIs (disabled until explicit configuration):

- POST `/api/admin/blog/posts`: create.
- GET `/api/admin/blog/posts/[id]`: coherent editor document.
- PUT `/api/admin/blog/posts/[id]`: manual/automatic draft save.
- POST `/api/admin/blog/posts/[id]/release`: publish or reserve.
- POST `/api/admin/blog/posts/[id]/state`: unpublish or cancel reservation.
- POST `/api/admin/blog/scheduled`: manually invoke the reserved-publication worker for validation.

Required BLOG-only variables:

- `BLOG_SUPABASE_URL`
- `BLOG_SUPABASE_SERVICE_ROLE_KEY` (server only)
- `BLOG_SUPABASE_ANON_KEY` (public read client constructed on the server)
- `BLOG_ADMIN_ENABLED=true`
- `BLOG_DB_WRITES_ENABLED=true`

There is NO fallback to the production `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` variables.
Do not set these flags in production until the migration and production application are approved.
Admin writes require a matching Origin, JSON-object input, and an actual streamed body size <=1 MB.
Admin responses use no-store/noindex, and error bodies never expose database details.
Public reads use the anon client and an explicit public-revision query, never the admin editor query.

## Dialogue Scene and beginner template

A `DIALOGUE_SCENE` block holds `data.turns`, an ordered array of 1–100 utterances. Each has a stable UUID,
`character`, `pose`, `text`, and `alignment` (`auto`, `left`, `right`). A scene moves/duplicates as one
editor block; its turns remain separately editable. Individual DIALOGUE/AI_MATE blocks remain supported.
Human/mate images use a verified registry: 15 human PNGs and 16 mate PNGs; no filenames are generated.

`lib/blog/beginnerTemplate.mjs` defines a beginner scaffold:
scene -> text -> POINT -> IMAGE -> DATA_CHECK -> scene -> heading/summary -> related articles -> CTA.
The introductory scene is Ichika -> Hatsune -> Kiina -> Ichika. It has no fabricated statistics.
The IMAGE has no selected media ID and publication is rejected until a real public image is supplied.
The template remains an editorial scaffold, not a completed/published article or seeded production row.
Finish its rendered image, typography, dialogue/editor and mobile checks before mass content creation.

A note exporter demonstrates that structured scene turns can retain character attribution outside HTML.
Other SNS outputs remain a future phase.

## Autosave / Safari preparation

`lib/blog/autosave.mjs` serializes draft requests, debounces changes, tracks dirty/saving/saved timestamp/
error/conflict, preserves edits arriving during an in-flight save, and blocks blind retries after 409.
It calls only the draft-saving endpoint, never release. `saveNow` drains an in-flight save and pending
changes; publication UI must ensure dirty=false and no error/conflict before initiating release.

`app/admin/blog/_lib/useBlogAutosave.js` adds same-origin fetch, serialized IndexedDB recovery snapshots,
visibilitychange flush and online retry. No fragile unload beacon is used. Recovery is offered for
explicit confirmation/merge; it is never silently written over the newest server version.
IndexedDB can be unavailable/full/private-mode restricted. Failure of the optional local backup does
not prevent server saves. Mobile Safari can terminate network requests when backgrounded; this is not
a guarantee against every device shutdown/data-loss scenario. Actual editor status UI and Safari
real-device testing are deferred to the editor phase. Logout/recovery-data lifecycle must be wired into
that UI to avoid showing old drafts on a shared admin device.

## Validation / reproduction

Run:

    npm ci --prefix scripts/blog
    npm --prefix scripts/blog test

Test dependency: PGlite 0.3.14, pinned in a separate package/lockfile; root app dependencies are unchanged.
The engine executes real PostgreSQL 17.5 SQL/RLS in an isolated process, with simulated Supabase roles
and default grants. Test fixtures are local only and never query/write production race data.

31 tests cover migration, all table RLS and write grants, function permissions, draft/member visibility,
public immutability, reservation invisibility/promotion/cancellation, atomic rollback, stale-version
conflicts, scenes/poses, verified image filenames, private media, source tables remaining unchanged,
API guards/body size/error privacy, autosave statuses/offline recovery and request serialization.

Limitations: no hosted Supabase/PostgREST or Storage end-to-end test, no real concurrent network clients,
no iPhone UI test in this phase. Before production application, validate the reviewed migration on a
hosted development database and run security advisors and API/Storage tests; keep production untouched.
The database test is a local validation, not a claim that all production migrations were replayed.

## Application compilation

`npm run build` with the unchanged root package compiled the new Next.js modules successfully
(Next.js 16.3.8 in this local install). Full prerender stopped in the existing `/bsc2` Firebase code
with `auth/invalid-api-key` because the local workspace has no Firebase environment values.
The full site build is therefore NOT reported as passing. Existing Firebase files were not modified.
No runtime package changes/lockfile were introduced at the app root.

## PHASE 2

Implement `/blog` top, article-card/list data queries and category/search entry points. Show only real
public snapshots. Do not fabricate rankings/view counts or publish the incomplete scaffold. Keep legacy
URLs and prediction modules unchanged. The full editor/status UI, hosted scheduled job, uploads, SEO,
RACE/BLOG global navigation and the beginner article rendering follow the agreed phases.
