// The two blog-ai-v13 comparison drafts on staging, generated 2026-10-18 from the Preview of a98c7555 (once each, by the
// editor, from the admin screen) and copied read-only (SELECT) into fixtures/*-v13-staging-20261018.json, unedited
// (edit version 1), with the md5 of each value as staging computes it (checked in aiQualityV52.test.mjs).
// - Kiryu (stadium-basics-kiryu-course-v13): the official page fetched again at generation (2026-10-18 13:20 UTC); its
//   figures and words are those of the 2026-10-10 fetch, only its content hash differs.
// - Toda (stadium-basics-toda-course-v13): official page fetched 2026-10-12 06:36 UTC (as v10 to v12).
import { readFileSync } from 'node:fs';

const load = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}-v13-staging-20261018.json`, import.meta.url), 'utf8'));
const documentOf = s => ({
  schema_version: 1, title: s.title, excerpt: s.excerpt, category_id: null, cover: {}, noindex: false, author_ids: [], tag_ids: [], relations: [],
  seo: structuredClone(s.seo), blocks: structuredClone(s.blocks),
});

export const todaV13Staging = load('toda'), kiryuV13Staging = load('kiryu');
export const todaV13Pack = structuredClone(todaV13Staging.source_pack), kiryuV13Pack = structuredClone(kiryuV13Staging.source_pack);
export const todaV13Document = documentOf(todaV13Staging), kiryuV13Document = documentOf(kiryuV13Staging);
