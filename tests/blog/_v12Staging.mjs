// The two blog-ai-v12 comparison drafts on staging, generated 2026-10-18 from the Preview of 40c592b1 (once each, by the
// editor, from the admin screen) and copied read-only (SELECT) into fixtures/*-v12-staging-20261018.json, unedited
// (edit version 1): post, revision, blocks, SEO, the notes recorded at generation and the whole source pack (version 5,
// page text included). Each file keeps the md5 of its values as staging computes them (md5(jsonb::text)), and
// aiQualityV51.test.mjs checks the copies against them.
// - Toda (stadium-basics-toda-course-v12): official page fetched 2026-10-12 06:36 UTC (the same fetch as v10 and v11).
// - Kiryu (stadium-basics-kiryu-course-v12): official page fetched 2026-10-10 08:22 UTC.
import { readFileSync } from 'node:fs';

const load = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}-v12-staging-20261018.json`, import.meta.url), 'utf8'));
const documentOf = s => ({
  schema_version: 1, title: s.title, excerpt: s.excerpt, category_id: null, cover: {}, noindex: false, author_ids: [], tag_ids: [], relations: [],
  seo: structuredClone(s.seo), blocks: structuredClone(s.blocks),
});

export const todaV12Staging = load('toda'), kiryuV12Staging = load('kiryu');
export const todaV12Pack = structuredClone(todaV12Staging.source_pack), kiryuV12Pack = structuredClone(kiryuV12Staging.source_pack);
export const todaV12Document = documentOf(todaV12Staging), kiryuV12Document = documentOf(kiryuV12Staging);
