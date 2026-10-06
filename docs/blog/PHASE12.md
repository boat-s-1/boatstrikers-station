# PHASE 12A / 12B checkpoint

PHASE 11 protections remain unchanged: `publish_at` contract, real tag projection, private draft uploads, null-cover release and private OGP checks. Main and production Supabase are untouched.

## 12A adjustments

- RACE/BLOG controls, BLOG header navigation and dialogue turn actions have minimum 44px height.
- Editor inputs cannot enlarge flex/grid layout by their intrinsic width; long content wraps; editing tabs scroll inside their own container.
- Keyboard observer checks actual visual viewport and focused input boundaries. It scrolls only obscured fields on keyboard resize or focus changes, not on every viewport scroll. Updates coalesce into one animation frame and event listeners are removed on unmount. This avoids repeated re-centering while editing.
- Existing keyboard-open CSS continues to hide the fixed editing bar above the 100px inset threshold and restores it when the viewport expands. Existing 16px field text, safe-area padding, portraits/compact speeches and optional article boxes remain.
- Two new viewport/controller tests cover title/dialogue/SEO field geometry, offset, focus while keyboard open, scroll-loop prevention, restoration and cleanup. BLOG tests: 85 pass, 12 HTTP-only tests skipped offline. Targeted build passes; verify full Vercel deployment before handoff.

This is code and automated viewport verification, not an agent-operated physical iPhone/Safari test. The cloud browser is Chrome and does not expose supported viewport/device emulation controls. Safari keyboard and browser toolbar overlap need real-device confirmation on the supplied Preview. Actual authenticated admin CRUD is also pending isolated verification database setup.

## 12B environment discovery

Supabase organization: `boat-strike` (`epuxscypfyrfyhzwmszo`). Both connected links list the same projects: BoatStrikers production (`rzosrbkyniyedolhkgxo`) and unrelated `resort style`. The production project has no development branches. No suitable isolated BLOG test project exists. Neither project was mutated. No remote migration, Storage policy, project or branch was created.

Next prerequisite: user specifies an existing isolated test project or chooses the organization for a new project. The Supabase project/branch creation tools require organization selection and cost confirmation; do not silently allocate a paid environment. Preview BLOG credentials must point exclusively to that test environment and never inherit race production credentials. No production key should be copied into BLOG configuration.

## 12B execution checklist once configured

1. Confirm isolated project ref differs from production; snapshot schema/settings and migration history. Review BLOG SQL, apply only there, run security advisors and inspect grants/RLS. Provision private BLOG Storage bucket with no anon/member read policies.
2. Set BLOG variables on this Git feature branch's Preview only: URL, anon key, server-only service role, private bucket, admin enabled and write enabled. Keep production untouched. Validate environment scope before deployment.
3. Create disposable labelled verification article; record all IDs. Exercise create/save/autosave/reload/resume/editor preview; publish/unpublish; edit publication and verify anonymous readers still see the sealed public snapshot.
4. Open two authenticated editor sessions at the same version; save A, then B; B must receive 409 and preserve its unsaved content. Check both API response and UI.
5. Upload genuine test images to private Storage; unauthenticated public URL and BLOG private proxy must deny access. Test cover/body/OGP selection and private-media release guards. Current implementation intentionally requires explicit preparation for public images; there is no automatic publication-time image promotion. Resolve and test this before claiming the user's publication-image requirement passed.
6. Reserve a future JST time; verify absence in public reader/sitemap before due. If no worker, use an isolated verification-only invocation of `blog_publish_due` after real elapsed due time and report the required production worker configuration separately. Editing afterward must not replace the sealed queued revision.
7. Exercise anonymous PostgREST requests to posts/revisions/blocks/media: drafts, scheduled revisions, editing revisions and private images invisible. Test due published snapshots, archives/search/relations/theme CTAs.
8. Inspect live metadata/canonical/OGP/BlogPosting/BreadcrumbList and sitemap inclusion. Preview's sitemap deliberately excludes BLOG URLs; production-mode sitemap logic needs a separate isolated verification harness, not changing this Preview to a production deployment.
9. Production GA reception remains pending: new BLOG events deliberately do not transmit on Preview hosts. Do not enable production telemetry merely to populate tests.

## Proposed production procedure — only after separate authorization

Back up production and record the current deployment; re-review SQL plus hosted test evidence. Apply only additive BLOG migration, verify grants/RLS/advisors. Configure private/public image handling, BLOG-only environment settings and scheduled worker deliberately. Ship the approved Git commit, initially keep writes and scheduling disabled; smoke-test public zero state and legacy race/member functions, then enable editor operations and publish approved real content. Do not publish fixtures.

## Rollback procedure

Disable BLOG writes and scheduled worker first. Return Vercel to the recorded preceding production deployment. If public BLOG needs hiding, remove/disable BLOG-only public configuration without changing race credentials. Preserve BLOG tables, immutable snapshots and publication history; do not DROP tables or destructively reverse migrations during rollback. Restore previous BLOG environment values and cancel test schedules deliberately. Recheck race/member pages. Keep private Storage private; handle any deliberately public assets and CDN invalidation individually if their exposure must be revoked. No production rollback command has been executed.
