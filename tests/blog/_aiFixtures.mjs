import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { validateDocument } from '../../lib/blog/document.mjs';
import { blockingCount } from '../../lib/blog/ai/validate.mjs';

export const NOW = () => new Date('2026-10-09T03:00:00Z');
export const catalogue = { categoryId: randomUUID(), categoryName: '24場の基本', authorIds: { ichika: randomUUID(), hatsune: randomUUID(), kiina: randomUUID(), editorial: randomUUID() } };
export const basicsTopic = { id: randomUUID(), topic_key: 'stadium-basics:kiryu:water', category_slug: 'stadium-basics', stadium_slug: 'kiryu', angle: 'water', title_hint: '桐生の水面と干満差', character_key: 'ichika', status: 'candidate' };
export const charmTopic = { id: randomUUID(), topic_key: 'stadium-charm:kiryu:gourmet', category_slug: 'stadium-charm', stadium_slug: 'kiryu', angle: 'gourmet', title_hint: '桐生の場内グルメ', character_key: 'hatsune', status: 'candidate' };

// A well-behaved AI answer: numbers only from facts (52.2 is 桐生 1コース1着率 in lib/stadiumBasicGuide24.js), cited with S1.
export const goodAi = () => ({
  title: '桐生の水面と干満差を基本から確認する', excerpt: '桐生の水質・干満差・コース別1着率を、BOAT RACE公式データをもとに整理します。展示や当日の水面と合わせて確認する入口にしてください。',
  seo_title: '桐生の水面と干満差の基本', seo_description: '桐生の水質・干満差・コース別1着率を、BOAT RACE公式データをもとに初心者向けに整理します。当日の水面確認の入口にどうぞ。',
  takeaways: ['桐生の水質と干満差', '1コース1着率の水準'],
  sections: [
    { heading: '桐生の水面の基本', blocks: [
      { type: 'text', text: '桐生は淡水の水面で、干満差はなしです。', items: [], turns: [], source_ids: ['S1'] },
      { type: 'point', text: '集計期間の1コース1着率は52.2%です。', items: [], turns: [], source_ids: ['S1'] },
      { type: 'dialogue', text: null, items: [], turns: [{ character: 'ichika', pose: 'pose1', text: 'まずは1コースの数字から見てみるよ。' }, { character: 'kiina', pose: 'pose3', text: '外はどうなの？' }], source_ids: [] },
    ] },
    { heading: '当日に確認したいこと', blocks: [{ type: 'data_check', text: '展示タイム・スタート展示・風向きを確認します。', items: [], turns: [], source_ids: [] }] },
  ],
  summary: '桐生は淡水で干満差なし。まずは1コースの数字を入口に、当日の水面を確認しましょう。', needs_check: ['ナイター開催の時期は公式サイトで確認'],
});

export function memoryStore({ documents = [], titles = [] } = {}) {
  const state = { topics: new Map([[basicsTopic.id, { ...basicsTopic }], [charmTopic.id, { ...charmTopic }]]), urls: [], documents: [...documents], drafts: new Map(), approvals: [], media: [], manual: [], derivatives: [], runs: [] };
  return { state,
    async catalogue() { return catalogue; },
    async topic(id) { const t = state.topics.get(id); if (!t) throw Object.assign(new Error('nf'), { status: 404 }); return t; },
    async setTopic(id, patch) { Object.assign(state.topics.get(id), patch); },
    async postTitles() { return titles; },
    async ensureSourceUrls(rows) { for (const r of rows) if (!state.urls.some(u => u.url === r.url)) state.urls.push({ id: randomUUID(), active: true, ...r }); },
    async sourceUrls(slug) { return state.urls.filter(u => u.stadium_slug === slug); },
    async insertDocument(record) { state.documents.unshift(record); return record; },
    async documents(slug) { return state.documents.filter(d => d.stadium_slug === slug); },
    async uploadCover(bytes, meta) { const m = { id: randomUUID(), bytes: bytes.length, ...meta }; state.media.push(m); return m; },
    async insertAiDraft(row) { state.drafts.set(row.post_id, { status: 'needs_review', ...row }); },
    async aiDraft(id) { return state.drafts.get(id) ?? null; },
    async recordValidation(id, issues, version) { Object.assign(state.drafts.get(id), { validation: issues, blocking_issues: blockingCount(issues), validated_version: version }); },
    async approve(postId, version, name, session) { const a = { id: randomUUID(), post_id: postId, edit_version: version, approver_name: name, session }; state.approvals.push(a); return { approval_id: a.id }; },
    async latestApproval(postId) { const a = state.approvals.filter(x => x.post_id === postId).at(-1); return a ? { ...a, revision_id: a.revision_id ?? 'rev-1', created_at: NOW().toISOString() } : null; },
    async manualSources(postId) { return state.manual.filter(m => m.post_id === postId); },
    async insertManualSource(row) { state.manual.push(row); return { id: randomUUID() }; },
    async postState(postId) { return state.posts?.get(postId) ?? { id: postId, slug: 'x', state: 'draft', editing_revision_id: 'rev-1', scheduled_revision_id: null, published_revision_id: null }; },
    async authors() { return Object.entries(catalogue.authorIds).map(([slug, id]) => ({ id, slug, character_key: ['ichika', 'hatsune', 'kiina'].includes(slug) ? slug : null })); },
    async categoryName() { return catalogue.categoryName; },
    async setDraftCover(postId, mediaId) { if (state.drafts.get(postId)) state.drafts.get(postId).cover_media_id = mediaId; },
    async insertDerivatives(rows) { const out = rows.map(r => ({ id: randomUUID(), status: 'draft', ...r })); state.derivatives.push(...out); return out; },
    async derivatives(postId) { return state.derivatives.filter(d => d.post_id === postId && d.status === 'draft'); },
    async discardDerivative(postId, id) { const d = state.derivatives.find(x => x.id === id && x.post_id === postId); if (d) d.status = 'discarded'; },
    async queuedTopics() { return [...state.topics.values()].filter(t => t.status === 'candidate'); },
    async registerTopic(c) { if ([...state.topics.values()].some(t => t.topic_key === c.topic_key)) throw Object.assign(new Error('dup'), { status: 409 }); const t = { id: randomUUID(), status: 'candidate', created_at: NOW().toISOString(), ...c }; state.topics.set(t.id, t); return t; },
    async topics() { return [...state.topics.values()]; },
    async insertRun(row) { const r = { id: randomUUID(), started_at: NOW().toISOString(), ...row }; state.runs.push(r); return { id: r.id }; },
    async finishRun(id, patch) { Object.assign(state.runs.find(r => r.id === id), patch, { finished_at: NOW().toISOString() }); },
    async recentRuns() { return [...state.runs].reverse(); },
  };
}
export function memoryRepo() {
  const posts = new Map(); const calls = { release: 0 };
  return { posts, calls,
    async create(slug, document) { if ([...posts.values()].some(p => p.slug === slug)) throw Object.assign(new Error('dup'), { code: '23505' }); const id = randomUUID(); posts.set(id, { id, slug, version: 1, revision_id: 'rev-1', state: 'draft', document: validateDocument(document) }); return { id, version: 1, revision_id: 'rev-1' }; },
    async editor(id) { const p = posts.get(id); return p ? { ...p, document: structuredClone(p.document) } : p; },
    async save(id, version, document) { const p = posts.get(id); if (p.version !== version) throw Object.assign(new Error('conflict'), { status: 409 }); p.version += 1; p.document = validateDocument(document); return { id, version: p.version, revision_id: p.revision_id }; },
    async release() { calls.release++; throw new Error('pipeline must never release'); },
  };
}
export const fakeCover = async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, ...new Array(2000).fill(1)]);
export const html = body => `<!doctype html><html><head><title>BOAT RACE桐生 公式</title><meta name="description" content="桐生の公式サイトです。"></head><body><nav>menu</nav><p>${body}</p><script>var x=1</script></body></html>`;
export function fakeFetch(routes) {
  const seen = [];
  const impl = async (url) => {
    seen.push(String(url));
    const r = routes[String(url)] ?? routes.default;
    if (r instanceof Error) throw r;
    if (!r) return new Response('', { status: 404 });
    return new Response(r.body ?? '', { status: r.status ?? 200, headers: r.headers ?? { 'content-type': 'text/html; charset=utf-8' } });
  };
  impl.seen = seen; return impl;
}

