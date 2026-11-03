import test from 'node:test';
import assert from 'node:assert/strict';
import { NOW, basicsTopic, goodAi, memoryStore, memoryRepo, fakeCover, fakeFetch, html } from './_aiFixtures.mjs';
import { kiryuPageRow } from './_kiryuRegression.mjs';
import { todaV13Pack, todaV13Document } from './_v13Staging.mjs';
import { runDraftPipeline } from '../../lib/blog/ai/pipeline.mjs';
import { runLoggedDraft } from '../../lib/blog/ai/schedule.mjs';
import { draftStatus } from '../../lib/blog/ai/approval.mjs';
import { validateAiDocument } from '../../lib/blog/ai/validate.mjs';
import { scorecard } from '../../lib/blog/ai/scorecard.mjs';
import { buildInput } from '../../lib/blog/ai/prompt.mjs';
import { publicReason, REFRESH_STATUS } from '../../lib/blog/ai/sourceRefresh.mjs';

const DATA_URL = 'https://www.boatrace.jp/owpc/pc/data/stadium?jcd=01';
const SITE_URL = 'https://www.kiryu-kyotei.com/';
const daysAgo = n => new Date(NOW().getTime() - n * 86400000).toISOString();
const stored = (id, fetched_at, extra = {}) => ({ ...kiryuPageRow, id, fetched_at, ...extra });
const siteRow = (id, fetched_at) => ({ id, stadium_slug: 'kiryu', url: SITE_URL, kind: 'official', fetched_at, title: '桐生公式', content_sha256: 'site-' + id,
  extracted_text: '桐生ボートレース場の公式サイトです。開催日程やアクセスの案内を掲載しています。', fetch_error: null });
const timeout = () => Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:443 via proxy.internal.corp'), { name: 'AbortError' });
const internal = () => new Error('getaddrinfo ENOTFOUND proxy.internal.corp token=abc123');
const page = html('桐生の場データのページです。コース別の成績などを掲載しています。');
const quoteOf = r => r.posts.get(r.post_id).document.blocks.find(b => b.data?.placement === 'sources' && b.data.source_url === DATA_URL);

// One generation with the given stored documents and fetch routes; the store gives ids to the fetches it saves.
async function generate({ documents = [], routes = { default: { body: page } }, siteUrl = false, callAi = async () => ({ data: goodAi(), model: 'test-model' }) } = {}) {
  const store = memoryStore({ documents }), repo = memoryRepo();
  let n = 0;
  const insert = store.insertDocument;
  store.insertDocument = async record => { const saved = { id: `new-${++n}`, ...record }; await insert(saved); return saved; };
  if (siteUrl) store.state.urls.push({ id: 'u-site', stadium_slug: 'kiryu', url: SITE_URL, label: '桐生公式', kind: 'official', active: true });
  const fetchImpl = fakeFetch(routes);
  let calls = 0;
  const ai = async (...args) => { calls++; return callAi(...args); };
  const result = await runLoggedDraft({ store, topicId: basicsTopic.id, run: () => runDraftPipeline({ topicId: basicsTopic.id, store, repo, renderCover: fakeCover, now: NOW, fetchImpl, callAi: ai }) });
  const draft = store.state.drafts.get(result.post_id);
  return { ...result, store, repo, fetchImpl, draft, pack: draft.source_pack, posts: repo.posts, aiCalls: calls };
}
const failingData = { [DATA_URL]: timeout(), default: { body: page } };

test('a failed fetch with stored official data: the stored page is used, said so, and its own retrieval time stays the source time', async () => {
  const r = await generate({ documents: [stored('doc-old', daysAgo(9))], routes: failingData });
  const s2 = r.pack.sources.find(s => s.url === DATA_URL);
  assert.equal(s2.fetched_at, daysAgo(9), 'the stored success, never the failed attempt');
  assert.equal(s2.document_id, 'doc-old');
  assert.equal(r.pack.refresh.status, 'stored_after_failed_refresh');
  assert.equal(r.pack.refresh.attempted_at, NOW().toISOString());
  assert.deepEqual(r.pack.refresh.results.map(x => [x.url, x.ok, x.reason]), [[DATA_URL, false, '時間内に応答がありませんでした。']]);
  const used = r.pack.refresh.sources.find(x => x.source_id === s2.id);
  assert.deepEqual({ ...used }, { source_id: s2.id, url: DATA_URL, document_id: 'doc-old', fetched_at: daysAgo(9), content_sha256: kiryuPageRow.content_sha256,
    period: r.pack.official.period, status: 'stored_after_failed_refresh', refresh_attempted_at: NOW().toISOString(), reason: '時間内に応答がありませんでした。' });
  // The note: a warning (never blocking), with the failed attempt, the data used and its period.
  const notes = r.draft.validation.filter(i => i.code === 'official_refresh_failed');
  assert.equal(notes.length, 1);
  assert.equal(notes[0].level, 'warning');
  assert.match(notes[0].message, /^最新情報の再取得に失敗しました（2026\/10\/09 12:00・時間内に応答がありませんでした。）。保存済みの公式データ（BOAT RACE公式 ボートレース場データ（桐生）、取得日時 2026\/09\/30 12:00、集計期間 \d{4}\/\d{2}\/\d{2}〜\d{4}\/\d{2}\/\d{2}）を使って作成しています。/);
  // The article's sources line shows the stored retrieval time; the run log says the draft was made from stored data.
  assert.match(quoteOf(r).data.text, /取得日時 2026\/09\/30 12:00/);
  assert.doesNotMatch(quoteOf(r).data.text, /2026\/10\/09/);
  assert.equal(r.refresh_status, 'stored_after_failed_refresh');
  assert.match(r.store.state.runs[0].message, /^要修正\d+件・確認\d+件（再取得失敗・保存済みデータを使用）$/);
  // A draft, never approved or published by the pipeline.
  assert.equal(r.draft.status, 'needs_review');
  assert.equal(r.store.state.approvals.length, 0);
  assert.equal(r.repo.calls.release, 0);
});

test('the note changes no score and no guard, and is never sent to the AI', async () => {
  const r = await generate({ documents: [stored('doc-old', daysAgo(9))], routes: failingData });
  const document = r.posts.get(r.post_id).document;
  const issues = validateAiDocument({ document, pack: r.pack });
  const without = validateAiDocument({ document, pack: { ...r.pack, refresh: { ...r.pack.refresh, sources: [] } } });
  assert.deepEqual(issues.filter(i => i.code !== 'official_refresh_failed'), without);
  assert.deepEqual(scorecard({ document, pack: r.pack, issues }).axes, scorecard({ document, pack: r.pack, issues: without }).axes);
  assert.equal(issues.filter(i => i.level === 'blocking').length, without.filter(i => i.level === 'blocking').length);
  // The AI's input names no fetch record, document id or failure.
  const input = buildInput(r.pack);
  for (const word of ['refresh', 'document_id', 'doc-old', '時間内に応答']) assert.ok(!input.includes(word), word);
  // A date of the failed attempt in the text is not a source date.
  const dated = structuredClone(document);
  dated.blocks.push({ type: 'TEXT', data: { text: '2026年10月9日に公式ページを確認しました。', source_ids: ['S2'], source_url: DATA_URL, source_label: 'x' } });
  assert.ok(validateAiDocument({ document: dated, pack: r.pack }).some(i => i.code === 'unsupported_date' && /2026年10月9日/.test(i.message)));
});

test('a fetch that succeeds is used and recorded as this generation\'s fetch; no note', async () => {
  const r = await generate({ documents: [stored('doc-old', daysAgo(9))] });
  const s2 = r.pack.sources.find(s => s.url === DATA_URL);
  assert.equal(s2.document_id, 'new-1');
  assert.equal(s2.fetched_at, NOW().toISOString());
  assert.equal(r.pack.refresh.status, 'refreshed');
  assert.equal(r.pack.refresh.sources[0].status, 'refreshed');
  assert.ok(!r.draft.validation.some(i => i.code === 'official_refresh_failed'));
  assert.doesNotMatch(r.store.state.runs[0].message, /再取得/);
});

test('stored data under 7 days: no fetch, recorded as stored data within 7 days (never as the latest)', async () => {
  const r = await generate({ documents: [stored('doc-3d', daysAgo(3))] });
  assert.deepEqual(r.fetchImpl.seen, []);
  assert.equal(r.pack.refresh.status, 'stored_within_7_days');
  assert.equal(r.pack.refresh.attempted_at, null);
  assert.deepEqual(r.pack.refresh.results, []);
  assert.deepEqual(r.pack.refresh.sources.map(x => [x.document_id, x.status]), [['doc-3d', 'stored_within_7_days']]);
  assert.equal(REFRESH_STATUS.stored_within_7_days, '7日以内の保存済みデータを使用');
  assert.ok(!r.draft.validation.some(i => i.code === 'official_refresh_failed'));
});

test('no fetch tried because one page is recent: an older page used with it is labelled by its own age', async () => {
  const r = await generate({ siteUrl: true, documents: [stored('doc-3d', daysAgo(3)), siteRow('site-30d', daysAgo(30))] });
  assert.deepEqual(r.fetchImpl.seen, []);
  // The draft takes the older page's case, never "within 7 days" for all.
  assert.equal(r.pack.refresh.status, 'stored_not_refetched');
  const by = Object.fromEntries(r.pack.refresh.sources.map(x => [x.url, x.status]));
  assert.deepEqual(by, { [DATA_URL]: 'stored_within_7_days', [SITE_URL]: 'stored_not_refetched' });
  assert.equal(REFRESH_STATUS.stored_not_refetched, '7日を超える保存済みデータを使用（再取得は試みていない）');
});

test('a failed fetch and no stored official data: stopped before the AI, with no draft and no repository fallback', async () => {
  for (const documents of [[], [{ ...stored('doc-err', daysAgo(1)), fetch_error: '時間内に応答がありませんでした。', extracted_text: null }]]) {
    const store = memoryStore({ documents }), repo = memoryRepo();
    let calls = 0;
    await assert.rejects(() => runLoggedDraft({ store, topicId: basicsTopic.id, run: () => runDraftPipeline({ topicId: basicsTopic.id, store, repo, renderCover: fakeCover, now: NOW,
      fetchImpl: fakeFetch({ [DATA_URL]: internal(), default: { body: page } }), callAi: async () => { calls++; return { data: goodAi(), model: 'm' }; } }) }),
    e => e.status === 422 && /^公式情報の再取得に失敗し、使える保存済みの公式データもありません（取得できませんでした。）/.test(e.message) && !/proxy|ENOTFOUND|token/.test(e.message));
    assert.equal(calls, 0, 'the AI is not called');
    assert.equal(repo.posts.size, 0);
    assert.equal(store.state.drafts.size, 0);
    assert.equal(store.state.runs[0].status, 'failed');
    assert.doesNotMatch(store.state.runs[0].message, /proxy|ENOTFOUND|token/);
  }
});

test('several URLs, some failing: only the sources really taken from older data are noted', async () => {
  // The data page fails (stored copy used); the official site is fetched again: only S2 is noted.
  const byUrl = list => [...list].sort((x, y) => x[0].localeCompare(y[0]));
  const a = await generate({ siteUrl: true, documents: [stored('doc-old', daysAgo(9)), siteRow('site-old', daysAgo(9))], routes: { [DATA_URL]: timeout(), default: { body: page } } });
  assert.deepEqual(byUrl(a.pack.refresh.sources.map(x => [x.url, x.status])), byUrl([[DATA_URL, 'stored_after_failed_refresh'], [SITE_URL, 'refreshed']]));
  assert.equal(a.pack.refresh.status, 'stored_after_failed_refresh');
  assert.equal(a.draft.validation.filter(i => i.code === 'official_refresh_failed').length, 1);
  // The site fails (its stored copy used); the data page is fetched again: only the site's source is noted.
  const b = await generate({ siteUrl: true, documents: [stored('doc-old', daysAgo(9)), siteRow('site-old', daysAgo(9))], routes: { [SITE_URL]: timeout(), default: { body: page } } });
  assert.deepEqual(byUrl(b.pack.refresh.sources.map(x => [x.url, x.status])), byUrl([[DATA_URL, 'refreshed'], [SITE_URL, 'stored_after_failed_refresh']]));
  assert.match(b.draft.validation.find(i => i.code === 'official_refresh_failed').message, /保存済みの公式データ（桐生公式、取得日時 2026\/09\/30 12:00）/);
  // The site fails with nothing stored for it: nothing older is used, so no note (the failure stays in the results).
  const c = await generate({ siteUrl: true, documents: [stored('doc-old', daysAgo(9))], routes: { [SITE_URL]: timeout(), default: { body: page } } });
  // The draft is not "all refreshed": the unused failure is recorded apart from the sources, with no source warning.
  assert.equal(c.pack.refresh.status, 'refreshed_with_unused_failures');
  assert.equal(REFRESH_STATUS.refreshed_with_unused_failures, '使用した出典はこの生成のときに取得（使用しなかったURLの取得に失敗）');
  assert.deepEqual(c.pack.refresh.sources.map(x => [x.url, x.status]), [[DATA_URL, 'refreshed']]);
  assert.deepEqual(c.pack.refresh.unused_failures, [{ url: SITE_URL, attempted_at: NOW().toISOString(), reason: '時間内に応答がありませんでした。' }]);
  assert.ok(!c.pack.sources.some(x => x.url === SITE_URL), 'the failed URL is not a source of the draft');
  assert.deepEqual(byUrl(c.pack.refresh.results.map(x => [x.url, x.ok])), byUrl([[DATA_URL, true], [SITE_URL, false]]));
  assert.ok(!c.draft.validation.some(i => i.code === 'official_refresh_failed'));
  assert.match(c.store.state.runs[0].message, /（使用しなかったURLの取得失敗あり）$/);
  // A used page failing and an unused URL failing: the draft is the used page's case, and both are kept apart.
  const d = await generate({ siteUrl: true, documents: [stored('doc-old', daysAgo(9))], routes: { [DATA_URL]: timeout(), [SITE_URL]: timeout(), default: { body: page } } });
  assert.equal(d.pack.refresh.status, 'stored_after_failed_refresh');
  assert.deepEqual(d.pack.refresh.sources.map(x => [x.url, x.status]), [[DATA_URL, 'stored_after_failed_refresh']]);
  assert.deepEqual(d.pack.refresh.unused_failures.map(x => x.url), [SITE_URL]);
  assert.equal(d.draft.validation.filter(i => i.code === 'official_refresh_failed').length, 1);
  // The data page fails with nothing stored while the site is fetched: the course data is missing, so it stops.
  await assert.rejects(() => generate({ siteUrl: true, documents: [], routes: { [DATA_URL]: timeout(), default: { body: page } } }), e => e.status === 422);
});

test('the required source: the stadium data page for data themes, any official page for the charm theme', async () => {
  const { charmTopic } = await import('./_aiFixtures.mjs');
  const run = async (topic, { documents = [], routes }) => {
    const store = memoryStore({ documents }), repo = memoryRepo();
    store.state.urls.push({ id: 'u-site', stadium_slug: 'kiryu', url: SITE_URL, label: '桐生公式', kind: 'official', active: true });
    let calls = 0;
    const result = await runDraftPipeline({ topicId: topic.id, store, repo, renderCover: fakeCover, now: NOW, fetchImpl: fakeFetch(routes),
      callAi: async () => { calls++; return { data: goodAi(), model: 'm' }; } }).catch(e => e);
    return { result, calls, store };
  };
  // Data theme: the official site alone does not replace the data page.
  const data = await run(basicsTopic, { documents: [siteRow('site-old', daysAgo(9))], routes: { [DATA_URL]: timeout(), default: { body: page } } });
  assert.equal(data.result.status, 422);
  assert.equal(data.calls, 0);
  // Charm theme: the data page failing with nothing stored is not required (and not used); the site is fetched, so it goes on.
  const charm = await run(charmTopic, { routes: { [DATA_URL]: timeout(), default: { body: page } } });
  assert.equal(charm.calls, 1);
  const charmPack = charm.store.state.drafts.get(charm.result.post_id).source_pack;
  assert.ok(!charmPack.sources.some(x => x.url === DATA_URL));
  assert.equal(charmPack.refresh.status, 'refreshed_with_unused_failures');
  assert.deepEqual(charmPack.refresh.unused_failures.map(x => x.url), [DATA_URL]);
  // Charm theme with every URL failing and nothing stored: stopped before the AI.
  const none = await run(charmTopic, { routes: { default: timeout() } });
  assert.equal(none.result.status, 422);
  assert.equal(none.calls, 0);
});

test('a used page whose URL was not fetched this time is labelled by its age, not as a failed fetch', async () => {
  const { refreshRecord } = await import('../../lib/blog/ai/sourceRefresh.mjs');
  const pack = { built_at: NOW().toISOString(), sources: [{ id: 'S2', kind: 'official_data', url: DATA_URL, fetched_at: daysAgo(9), document_id: 'doc-old' }], official: null };
  const rec = refreshRecord({ pack, refresh: { attempted_at: NOW().toISOString(), results: [{ url: SITE_URL, ok: true, fetched_at: NOW().toISOString(), document_id: 'n1' }] } });
  assert.deepEqual(rec.sources.map(x => x.status), ['stored_not_refetched']);
  assert.equal(rec.status, 'stored_not_refetched');
  assert.deepEqual(rec.unused_failures, []);
});

test('the note is shown again on every reload of the draft, from what the draft recorded', async () => {
  const r = await generate({ documents: [stored('doc-old', daysAgo(9))], routes: failingData });
  const first = await draftStatus({ repo: r.repo, store: r.store, postId: r.post_id });
  const again = await draftStatus({ repo: r.repo, store: r.store, postId: r.post_id });
  for (const s of [first, again]) {
    assert.equal(s.refresh.status, 'stored_after_failed_refresh');
    assert.deepEqual(s.refresh, r.pack.refresh);
    assert.equal(s.validation.filter(i => i.code === 'official_refresh_failed' && !i.origin).length, 1, 'from the live check, once');
  }
  // A later successful fetch for the stadium does not change what this draft was made from.
  r.store.state.documents.unshift(stored('doc-later', NOW().toISOString()));
  const later = await draftStatus({ repo: r.repo, store: r.store, postId: r.post_id });
  assert.equal(later.refresh.status, 'stored_after_failed_refresh');
});

test('drafts made before the record are neither "refreshed" nor "fine": they have no record and no new note', async () => {
  assert.equal(todaV13Pack.refresh, undefined);
  const issues = validateAiDocument({ document: todaV13Document, pack: todaV13Pack });
  assert.ok(!issues.some(i => i.code === 'official_refresh_failed' || /再取得/.test(i.message)));
  const store = memoryStore(), repo = memoryRepo();
  const post = await repo.create('stadium-basics-toda-course-v13', todaV13Document);
  store.state.drafts.set(post.id, { post_id: post.id, status: 'needs_review', source_pack: todaV13Pack, validation: [], model: 'm', generated_at: NOW().toISOString() });
  const s = await draftStatus({ repo, store, postId: post.id });
  assert.equal(s.refresh, null);
});

test('failure reasons shown to editors never carry internal details', () => {
  assert.equal(publicReason('時間内に応答がありませんでした。'), '時間内に応答がありませんでした。');
  assert.equal(publicReason('取得に失敗しました（HTTP 503）。'), '取得に失敗しました（HTTP 503）。');
  for (const raw of ['取得できませんでした：getaddrinfo ENOTFOUND proxy.internal.corp', 'Error: token=abc123 at /var/task/x.js', '', null])
    assert.equal(publicReason(raw), '取得できませんでした。');
});

test('the drafts list asks for the record\'s status as one column (null for drafts made before)', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  const { aiStore } = await import('../../lib/blog/ai/store.mjs');
  const seen = [];
  const fetch = async url => { seen.push(new URL(String(url))); return new Response(JSON.stringify([{ post_id: 'p1', refresh_status: null }]), { status: 200, headers: { 'content-type': 'application/json' } }); };
  const client = createClient('https://example.invalid', 'test-key', { global: { fetch }, auth: { persistSession: false } });
  const rows = await aiStore(client).aiDrafts();
  assert.equal(seen[0].pathname, '/rest/v1/blog_ai_drafts');
  assert.ok(seen[0].searchParams.get('select').split(',').includes('refresh_status:source_pack->refresh->>status'));
  assert.ok(seen[0].searchParams.get('select').split(',').includes('comparison:source_pack->comparison'));
  assert.deepEqual(rows, [{ post_id: 'p1', refresh_status: null }]);
});
