// The blog-ai-v11 comparison draft on staging, post stadium-basics-toda-course-v11 generated 2026-10-12 07:50 UTC
// (16:50 JST): its editing revision, its blocks and its source pack, copied read-only (SELECT) into
// fixtures/toda-v11-staging-20261012.json. Nothing here is rebuilt from the v10 draft: the file also keeps the md5 of
// each value as staging computes it (md5(jsonb::text)), and aiQualityV50.test.mjs checks the copy against them.
// Accurate and rated 5.0 on the PHASE 4.9 scorecard, yet read as an editor would (by Claude; no human rating yet) it is
// about 3.5: 一果 restates 初音's observation and closes with an unrelated pointer, the definition is said again, the
// summary joins two findings with an unnatural "一方" and ends without content, and "内側から順に高く" reads in either
// direction.
import { readFileSync } from 'node:fs';

export const todaV11Staging = JSON.parse(readFileSync(new URL('./fixtures/toda-v11-staging-20261012.json', import.meta.url), 'utf8'));

// The source pack exactly as stored (version 4; its readings are the ones the prompt was given).
export const todaV11Pack = structuredClone(todaV11Staging.source_pack);

// The editing revision as a document. The fields the revision does not hold for an AI draft are left empty.
export const todaV11Document = {
  schema_version: 1, title: todaV11Staging.title, excerpt: todaV11Staging.excerpt,
  category_id: null, cover: {}, noindex: false, author_ids: [], tag_ids: [], relations: [],
  seo: structuredClone(todaV11Staging.seo),
  blocks: structuredClone(todaV11Staging.blocks),
};

// The notes recorded when the draft was made (blog_ai_drafts.validation).
export const todaV11GenerationValidation = structuredClone(todaV11Staging.validation);
