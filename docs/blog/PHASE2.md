# BLOG PHASE 2

Branch: feature/blog-media-platform. No production migration, merge, article/template seed, prediction changes or production credential fallback.

## UI

`/blog` owns an editorial masthead, RACE/BLOG switch, search, category navigation, editorial picks, latest, public updates, recommendation fallback for future popularity data, authors, public tags, guide/how-to-use links and race/character CTA. Paper/forest palette; typographic identity and existing verified character assets. CSS Modules scope all styling. The main header, bottom navigation and character announcement popup are hidden only inside `/blog` and `/blog/…`.

No fake article cards, ranking positions, PV, release dates or article counts. Unconfigured BLOG database shows an explicit pre-publication empty state with static editorial author/category identities from PHASE 1. A configured failing reader shows an unavailable notice. The beginner scaffold is not read, imported, or published.

## Public fetching

`publicServer.js` is server-only, creates an anonymous client from explicit BLOG_SUPABASE_URL/BLOG_SUPABASE_ANON_KEY only, and uses uncached reads. No service-role/admin dependency.

`readPublicIndex` uses explicit projections. Posts must have state=published, a non-null published_revision_id and first_published_at<=request time. Only those exact revision IDs are read, with state=sealed and matching post_id. RLS remains the second boundary. Blocks, draft/queued pointers, publication events and templates are never selected. Catalogues use active=true. Tags are displayed only if attached to a visible publication. Publication updates use last_published_at rather than editing timestamps. All fetch errors discard partial results.

Search is GET /blog?q=, literal NFKC-normalized title/excerpt matching; category/author/tag filters combine; 12 cards per page. Filtering occurs on the server over anon-visible snapshots. Public index reads use ordered 200-row batches; future high-volume DB search/pagination should replace whole-index filtering. This phase does not add body full-text search.

Editorial recommendations require BLOG_FEATURED_SLUGS (comma-separated curated slugs). Only matching visible snapshots are used; missing selections do not fall back to templates or arbitrary articles. No ranking metric source exists; popular area uses editorial recommendation UI.

## Phase boundary

Article cards are readable summaries, explicitly marked "記事詳細は近日公開"; there are no dead links to unimplemented detail routes. /blog/articles/[slug] and linked detail cards belong to PHASE 3. Author/category/tag links are working index filters, not unimplemented archive routes. All existing site URLs remain.

## Verification

38 tests passed (31 PHASE 1 regressions + 7 public-index tests). Covers exact public-pointer query, due publication constraints, missing snapshots, errors, combined literal filters, explicit curated picks, public updates/tags and pagination.

Local Next.js 16.3.8 build compiled successfully; full prerender blocked by existing /bsc2 Firebase auth/invalid-api-key without local environment. Preview build and responsive browser verification are recorded in the completion report. No hosted BLOG project is configured or migrated by this phase; populated hosted PostgREST end-to-end verification remains for an isolated environment before production activation.
