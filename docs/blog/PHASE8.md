# PHASE 8 — BLOG SEO

Branch: `feature/blog-media-platform`. No production migration, main merge, or PHASE 9 work.

## Implemented

- Article title/description, canonical, article OGP/Twitter, real publication/update timestamps, author URLs, category, tags and noindex come from the selected public snapshot.
- Dedicated OGP media can be selected in the admin SEO tab (`seo.og_media_id`, `seo.og_alt`). This uses the existing revision JSON and media registry; no new column or migration.
- Public media access remains anonymous + RLS (`status='public'`). Dedicated image → cover → `/blog/og` PNG fallback. Preview assets, credentials, signed-query URLs and unsafe protocols are rejected.
- BLOG top and category/author/tag archives have metadata. Existing query/filter URLs continue to work and are noindex. Dedicated URLs: `/blog/categories/[slug]`, `/blog/authors/[slug]`, `/blog/tags/[slug]`. Overview pages `/blog/categories` and `/blog/authors` are available.
- Article markup uses `BlogPosting` and `BreadcrumbList`; even the news category remains BlogPosting. No automatic NewsArticle inference.
- Character authors are explicitly BoatStrikers editorial characters. Structured authors use editorial Organization identities and do not claim real-person credentials, awards, qualifications or biographies.
- JSON-LD escaping protects closing script tags. Fixture/draft/Preview/noindex/future/unpublished articles emit no public article structured data.

## Index and Sitemap policy

- Query results (including pagination and empty query values): noindex; canonical BLOG root.
- Archive pagination: noindex, canonical first archive page.
- Empty category/author archives: noindex until an indexable public article exists.
- Tags default to noindex. `TAG_SEO` is an empty opt-in policy registry. A tag can index only after editorial approval, a unique substantive description of at least 80 characters, and five indexable due public snapshots. Setting a policy alone is insufficient. Policy and article count gate both metadata and Sitemap.
- Sitemap article entries require published state, due first publication time, a non-null published pointer, a matching revision ID and post ID, and `noindex=false`. Last modification uses actual public publication time, never editing/autosave time. An existing public article with a future scheduled update retains its current public snapshot.
- Preview environment: BLOG metadata + X-Robots-Tag are noindex; robots disallows all crawling; Sitemap is empty. Production keeps all existing RACE/guide/stadium Sitemap entries and robots rules.
- Public readers defensively repeat due/published checks after the RLS-filtered query. No draft/scheduled pointers or fixture imports were added to public readers.

## URLs

The existing DB trigger `BLOG_PUBLISHED_SLUG_IMMUTABLE` remains unchanged. No rename UI/API was added. Exceptional URL migration requires a reviewed entry in `lib/blog/slugRedirects.cjs`, a real accessible destination and a deliberate migration plan. Next permanent redirects are 308, internal, chain/cycle-free. The registry is currently empty: no actual URLs were redirected or deleted.

## Verification

- 51 unit/regression tests passed, including 12 new SEO policy tests.
- Four HTTP integration tests passed against a running production-mode targeted build: canonical/OGP host, search noindex, author identity/canonical, and real 1200×630 PNG fallback.
- BLOG/admin routes targeted production build passed. The initial whole-app local build compiled, but prerendering existing `/bsc2` stopped because this workspace lacks the existing Firebase API key. The Vercel full build uses the existing project configuration; inspect its status before declaring Preview ready.
- DB integration/migration tests were not rerun: there is no schema/RLS/RPC change and no migration was applied to any database.
- No real articles, PV, rankings or race values were created. The standard template remains a template.

## Preview

`/blog/preview/seo` is gated to Preview/local development, noindex and production 404. It displays actual metadata builder output and the BLOG OGP fallback. Its fixture has no publication date; it never enters public lists, search, Sitemap or Supabase.

Stop after PHASE 8 Preview confirmation. PHASE 9 navigation work is not authorized yet.
