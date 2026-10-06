# BLOG PHASE 3: article detail

Branch: feature/blog-media-platform. No merge, migration, database writes, public article seed, admin editor, or PHASE 4+ work.

## Routes

- `/blog/articles/[slug]`: real public snapshot only. No data means 404. Data API failures surface a generic error, never a fixture fallback.
- `/blog/preview/article`: explicit render fixture, enabled only in Vercel Preview or local development with no VERCEL_ENV. Vercel production always returns 404, including if NODE_ENV were development. The module is dynamically imported after this gate.
- `/blog`: approved editorial design preserved; common masthead/footer extracted to BlogShell. Zero-article panels made shorter. Real article cards now link to the implemented detail route.

The fixture never enters Supabase, templates, public reader/index/search, or Sitemap. Route + fixture image responses have X-Robots-Tag: noindex, nofollow, noarchive and private/no-store. robots.txt disallows both fixture prefixes. Page metadata is noindex/nofollow. No invented publication dates, race statistics, PV, ranking, or public articles.

## Detail layout

Breadcrumbs, category, title, byline and real public dates, public cover media, takeaways, native collapsed TOC, structured body, authored summary/notes/sources, author profiles, real public related snapshots or existing guides, theme CTA.

Structured blocks retain PHASE 1 schema_version=1; no database schema changes. Normal TEXT is plain paragraphs (HTML escaped), headings H2/H3 have UUID-based anchors, IMAGE resolves public media IDs, DIALOGUE/AI_MATE support the existing pose registry, DIALOGUE_SCENE renders ordered turns. DATA_CHECK/POINT/WARNING/QUOTE/CTA/RELATED_ARTICLES/RACE_LINK/LIST/TABLE/YOUTUBE are supported (video uses a link, not an arbitrary embedded iframe).

Optional `data.placement` values: takeaways, summary, notes, sources, ending (CTA). Only explicitly marked blocks move into layout sections. Unmarked authored blocks keep their order. Missing takeaways use actual H2 titles/excerpt, never invented claims. Related references resolve only to public snapshots; unavailable posts are omitted, never replaced with fabricated titles. Existing guide paths retain working links.

## Dialogue UI

Guide-style name/portrait/bubble. Ichika green, Hatsune purple/pink, Kiina gold. Auto is left and explicit right is supported. Mobile portrait 54px, consecutive same-speaker portrait 32px, with semantic name/continuation retained. A side change or different speaker breaks compact grouping. Poses come from exact verified filenames. Preview has a collapsed 5-pose check for all 3 humans, not an editor.

Body 16px, natural paragraph wrapping, narrow reading column, native details/summary without client JavaScript. Tables scroll inside their own container. Profiles use small portraits and topic CTAs reflect author expertise. Main site header/bottom navigation/popup remain hidden on BLOG routes. RouteScopedVisuals now also excludes BLOG, so character names in article slugs cannot trigger room wallpapers.

## Public data boundaries

Server-only anonymous BLOG credentials, no production race DB fallback and no service-role/admin dependency. Queries require published/due parent + exact sealed revision with matching post_id. Media columns exclude storage_path and rely on public-media RLS. Related articles repeat the same parent and snapshot conditions. Request-local React cache deduplicates metadata/page reads; fetch is no-store. Draft/queued revisions and editor timestamps are never selected. All authored content is React-escaped, URLs validated; no raw HTML rendering.

## Verification

48 tests passed: 38 PHASE 1/2 regressions + 10 detail/model/fixture boundary tests. These cover exact snapshot projection, absent/wrong/cross-post revisions, query errors, public related pointers, fixture environment gate/import isolation/crawler configuration, valid fixture + existing assets, H2/H3 anchors/sections, compact turns, themes and publication metadata.

Local Next.js 16.3.8 compiles successfully; full prerender still blocked by existing BSC2 Firebase credentials absent locally. Vercel Preview build/browser results are reported at completion. Hosted BLOG populated-data end-to-end verification remains for an isolated BLOG environment. PHASE 3 does not provision or migrate such an environment.
