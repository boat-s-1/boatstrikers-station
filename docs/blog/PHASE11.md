# PHASE 11 — integration verification

Branch: `feature/blog-media-platform`. Baseline: `9cadf175e5a79bc6e02bd2cd3fc192fa39d516e4`.
No production database writes, migrations, main merge or PHASE 12 work.

## Fixes

- The editor sent `publishAt` while the release route read `publish_at`: scheduling could become immediate publication. Shared publication payload and server validation now require an explicit timestamp or explicit null. Regression tests cover typo/missing time and invalid/past schedules.
- Admin catalogue requested author-only columns from `blog_tags`. The projection now matches the actual schema.
- Uploads previously made draft images public immediately. They now require `BLOG_PRIVATE_MEDIA_BUCKET` with `public=false`, insert private media with null public path, and expose only an authenticated, no-store/noindex admin image endpoint. Private images bypass Next image caching. Public article readers still use anon RLS and cannot see private media. No bucket or Storage policy was changed remotely.
- The unapplied BLOG migration now permits a cleared optional cover (`media_id:null`) and rejects private/missing OGP media during release, as it already does for body/cover images. The changed SQL must be reviewed and tested on hosted verification Supabase before application; it has NOT been applied anywhere remotely.
- Added missing `/blog/tags` directory using only tags referenced by actual public snapshots; empty when no articles; noindex. Added its entry from BLOG top.

## Automated verification

- BLOG: 83 passing unit/database tests (including 16 isolated PostgreSQL/PGlite tests); HTTP tests are skipped in the offline run and executed separately.
- HTTP: Preview mode 12 passed; production-equivalent local mode 8 passed, 4 Preview-only tests deliberately skipped. Tested directories/search/unknown routes, admin auth/write gates, metadata/OGP PNG, trial production 404, noindex and public isolation.
- Existing regression: 369/371 passed with `--experimental-vm-modules` and a temporary jsdom test dependency. Two failures reproduce identically on the PHASE 10 baseline: member auth source assertion differs from the existing access-token implementation; Today layout assertion expects 4 panels but existing page has 5. Related production code/tests were not modified to suppress these failures.
- Current delegated analytics click handler was executed with controlled targets: BLOG→RACE, BLOG→all three characters, rooms/race/stadium→BLOG correctly dispatch via existing GA wrapper. Preview host and Preview/admin routes remain excluded. This is handler validation, not proof of GA server receipt.
- Targeted Next build passed. The final Vercel Git deployment provides the full-site build result; confirm deployment SHA and READY before handoff.

## Live Preview checks

Initial deployment pages returned HTTP 200 without application errors: home, Today, races, all three rooms, guide, how-to-use, library, members, stadium/shimonoseki, BLOG top/search/categories/authors/all four author archives, article fixture, SEO fixture, navigation fixture, robots and sitemap. Admin pages correctly require the existing admin login.

Six speakers were edited in the actual Preview dialogue UI: speaker, pose2, text, right alignment, live-rendered speaker; turn add/move/clone/delete/fold and scene add/move/clone/delete/fold exercised. No test content was persisted. Article cover/body/character image loading was observed in the browser, with compact consecutive speech. Real-file registry tests cover every registered pose.

Preview robots disallows all crawling. Trial fixtures remain dynamically gated, noindex, absent from public index/search/sitemap and any database. Public positive-state/RLS/snapshot paths are tested with isolated DB and controlled reader responses, not fabricated public articles.

## Remaining checks before production

The deployed Preview has no isolated BLOG Supabase connection. Hosted PostgREST/Storage upload/download and actual admin create/save/publish/schedule/two-session conflict cannot be certified on that deployment. Local tests do establish the version/RLS/immutable-pointer behaviour. Hosted verification DB, reviewed migration, private Storage policies/bucket, public image preparation and scheduled worker configuration remain required. Private uploads intentionally cannot be published until explicitly prepared for public use; no automatic private→public media promotion was added in this verification phase.

This agent's browser is desktop Chrome. iPhone Safari software keyboard opening/closing, safe areas, touch/44px targets and narrow-screen horizontal overflow still need user's PHASE 12 real-device check. Existing keyboard viewport logic hides the fixed bar while keyboard is open and restores it afterward; no claim of an agent-run physical iPhone test.

Production GA receipt/debug verification is pending because Preview intentionally suppresses the new production BLOG events. Existing paid/private media systems were not modified or exhaustively audited; public character images are intentional. Do not claim all legacy paid assets are protected based only on BLOG tests.

## PHASE 12 user checklist (not started)

- BLOG zero-state top, search, categories/tags/authors and all four editorial trials.
- Long titles/text/dialogue, optional boxes/images/TOC, all three colors, compact repeated speech and smaller AI MATES.
- Dialogue editor all six actors, thumbnail taps, folds, arrows/clones/deletes; keyboard focus and fixed-bar restoration.
- RACE/BLOG switch, themed CTAs, guide/how-to-use and exact stadium routes; existing bottom navigation interference.
- Actual saved/published/scheduled/conflict workflow only after isolated hosted BLOG DB/Storage setup.

