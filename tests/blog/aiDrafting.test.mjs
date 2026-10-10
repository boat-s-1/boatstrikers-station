import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { candidateTopics, similarTitles, topicKey, topicSlug } from '../../lib/blog/ai/topics.mjs';
import { robotsAllows, fetchOfficialDocument, extractText, defaultSourceUrls, normalizeSourceUrl } from '../../lib/blog/ai/officialSources.mjs';
import { buildSourcePack } from '../../lib/blog/ai/sourcePack.mjs';
import { validateAiDocument, blockingCount } from '../../lib/blog/ai/validate.mjs';
import { composeDocument, NOTE_TEXT } from '../../lib/blog/ai/compose.mjs';
import { runDraftPipeline } from '../../lib/blog/ai/pipeline.mjs';
import { approveDraft, approverSession, approverName, draftStatus } from '../../lib/blog/ai/approval.mjs';
import { callOpenAIJson } from '../../lib/blog/ai/openai.mjs';
import { ARTICLE_SCHEMA, buildInstructions } from '../../lib/blog/ai/prompt.mjs';
import { coverSpec, renderCoverPng } from '../../lib/blog/ai/cover.mjs';
import { validateDocument } from '../../lib/blog/document.mjs';

import { NOW, catalogue, basicsTopic, charmTopic, goodAi, memoryStore, memoryRepo, fakeCover, html, fakeFetch } from './_aiFixtures.mjs';

test('topic candidates cover each stadium, skip registered keys and build stable slugs', () => {
  const all = candidateTopics({ categorySlug: 'stadium-basics' });
  assert.equal(all.length, 48);
  const kiryu = candidateTopics({ categorySlug: 'stadium-basics', stadiumSlug: 'kiryu', existingKeys: ['stadium-basics:kiryu:water'] });
  assert.deepEqual(kiryu.map(t => t.angle), ['course']);
  assert.equal(topicKey('data-lab', null, 'inside-24'), 'data-lab:all:inside-24');
  assert.equal(topicSlug(basicsTopic), 'stadium-basics-kiryu-water');
  assert.equal(candidateTopics({ categorySlug: 'characters', stadiumSlug: 'kiryu' }).map(t => t.character_key).join(), 'ichika,hatsune,kiina');
  assert.throws(() => candidateTopics({ categorySlug: 'news' }), /カテゴリー/);
});

test('near-duplicate titles are detected across BLOG posts and DATA LAB', () => {
  const hits = similarTitles('桐生の水面と干満差', [{ title: '桐生の水面と干満差の基本' }, { title: '大村のイン逃げ' }]);
  assert.equal(hits.length, 1); assert.ok(hits[0].score >= 0.8);
});

test('robots.txt rules, URL normalisation and default official URLs', () => {
  const robots = 'User-agent: *\nDisallow: /private\nAllow: /private/ok\n\nUser-agent: BadBot\nDisallow: /';
  assert.equal(robotsAllows(robots, '/private/x'), false);
  assert.equal(robotsAllows(robots, '/private/ok/page'), true);
  assert.equal(robotsAllows(robots, '/owpc/pc/data/stadium?jcd=01'), true);
  assert.equal(robotsAllows('User-agent: boatstrikersblogbot\nDisallow: /', '/a'), false);
  assert.equal(normalizeSourceUrl('http://example.com/'), null);
  assert.equal(normalizeSourceUrl('https://user:pw@example.com/'), null);
  assert.equal(normalizeSourceUrl('https://192.168.0.1/'), null);
  assert.equal(normalizeSourceUrl('https://www.example.jp/a#top'), 'https://www.example.jp/a');
  assert.deepEqual(defaultSourceUrls('kiryu').map(u => [u.url, u.kind]), [['https://www.boatrace.jp/owpc/pc/data/stadium?jcd=01', 'official_data']]);
});

test('official page fetch records time, hash and text; failures are recorded, never thrown', async () => {
  const source = { stadium_slug: 'kiryu', url: 'https://www.boatrace.jp/owpc/pc/data/stadium?jcd=01', kind: 'official_data' };
  const ok = await fetchOfficialDocument({ source, now: NOW, fetchImpl: fakeFetch({ 'https://www.boatrace.jp/robots.txt': { body: 'User-agent: *\nDisallow: /secret' }, default: { body: html('桐生は淡水の水面です。ナイター開催の場として知られています。') } }) });
  assert.equal(ok.fetch_error, null); assert.equal(ok.fetched_at, '2026-10-09T03:00:00.000Z'); assert.match(ok.content_sha256, /^[0-9a-f]{64}$/);
  assert.match(ok.extracted_text, /淡水の水面/); assert.doesNotMatch(ok.extracted_text, /var x/); assert.equal(ok.title, 'BOAT RACE桐生 公式');

  const sjis = new Uint8Array([0x93, 0x8c, 0x8b, 0x9e]); // 「東京」 in Shift_JIS
  const body = new Uint8Array([...new TextEncoder().encode('<html><head><meta charset="Shift_JIS"></head><body><p>'), ...sjis, ...new TextEncoder().encode('の水面について、公式の案内ページにある説明文です。十分な長さの本文です。</p></body></html>')]);
  const decoded = await fetchOfficialDocument({ source, now: NOW, fetchImpl: fakeFetch({ default: { body, headers: { 'content-type': 'text/html' } } }) });
  assert.match(decoded.extracted_text, /^東京/m);

  const cases = [
    [{ 'https://www.boatrace.jp/robots.txt': { body: 'User-agent: *\nDisallow: /owpc' } }, /robots/],
    [{ default: { status: 404 } }, /HTTP 404/],
    [{ default: { status: 301 } }, /転送/],
    [{ default: { body: '<html></html>' } }, /本文/],
    [{ default: { body: '{}', headers: { 'content-type': 'application/json' } } }, /HTML/],
    [{ default: new Error('boom') }, /取得できませんでした/],
  ];
  for (const [routes, message] of cases) {
    const r = await fetchOfficialDocument({ source, now: NOW, fetchImpl: fakeFetch(routes) });
    assert.match(r.fetch_error, message); assert.equal(r.extracted_text, null); assert.equal(r.fetched_at, '2026-10-09T03:00:00.000Z');
  }
  const foreign = await fetchOfficialDocument({ source: { ...source, url: 'https://unregistered.example.com/' }, now: NOW, fetchImpl: fakeFetch({}) });
  assert.match(foreign.fetch_error, /登録されていない/);
  assert.equal(extractText('<p>A &amp; B&#12354;</p>').text, 'A & Bあ');
});

test('source pack: verified facts with source ids; charm topics require fetched official text', () => {
  const pack = buildSourcePack({ topic: basicsTopic, now: NOW });
  assert.equal(pack.sources[0].id, 'S1'); assert.equal(pack.sources[0].fetched_at, null); assert.equal(pack.sources[0].period, '2026/05/01〜2026/07/31');
  assert.ok(pack.facts.some(f => f.label === '桐生の1コース1着率' && f.value === '52.2' && f.source_id === 'S1'));
  assert.deepEqual(buildSourcePack({ topic: charmTopic, now: NOW }).gaps, ['official_documents_missing']);
  const doc = { stadium_slug: 'kiryu', url: 'https://www.kiryu-kyotei.example/gourmet', kind: 'official_site', fetched_at: NOW().toISOString(), extracted_text: '場内の売店ではもつ煮を提供しています。', title: '桐生グルメ', content_sha256: 'a'.repeat(64), fetch_error: null };
  const charm = buildSourcePack({ topic: charmTopic, documents: [doc, { ...doc, url: 'https://x.example/', fetch_error: 'x', extracted_text: null }], now: NOW });
  assert.equal(charm.documents.length, 1); assert.deepEqual(charm.gaps, []); assert.equal(charm.sources[0].fetched_at, NOW().toISOString());
  assert.match(buildInstructions(charm), /使ってよい事実は、入力JSONの facts と documents/);
});

test('compose builds a valid BLOG document with citations, notes and a dated sources section', () => {
  const pack = buildSourcePack({ topic: basicsTopic, now: NOW });
  const { slug, document, issues } = composeDocument({ ai: goodAi(), pack, topic: basicsTopic, catalogue, coverMediaId: randomUUID(), coverAlt: '表紙' });
  assert.equal(slug, 'stadium-basics-kiryu-water');
  assert.equal(document.blocks[0].data.placement, 'takeaways');
  assert.ok(document.blocks.some(b => b.type === 'DIALOGUE_SCENE' && b.data.turns.length === 2));
  const sources = document.blocks.filter(b => b.data.placement === 'sources');
  assert.equal(sources.length, 1); assert.equal(sources[0].data.text, 'BoatStrikers収録データ（BOAT RACE公式・桐生・2026/05/01〜2026/07/31集計）｜集計期間 2026/05/01〜2026/07/31｜取得日時 記録なし');
  assert.ok(document.blocks.some(b => b.data.text === NOTE_TEXT));
  assert.equal(document.seo.stadium_slug, 'kiryu'); assert.ok(document.cover.media_id); assert.equal(document.author_ids[0], catalogue.authorIds.ichika);
  // The summary states 淡水・干満差なし without numbers: cited automatically from the source of those facts (PHASE 4.2).
  assert.deepEqual(issues.map(i => i.code), ['auto_cited', 'needs_check']);
  assert.deepEqual(document.blocks.find(b => b.data.placement === 'summary').data.source_ids, ['S1']);
  const bad = goodAi(); bad.sections[0].blocks[0].source_ids = ['S9'];
  assert.equal(composeDocument({ ai: bad, pack, topic: basicsTopic, catalogue }).issues[0].code, 'unknown_source');
});

test('validator blocks fabricated numbers, uncited numbers, banned phrases and unknown URLs', () => {
  const pack = buildSourcePack({ topic: basicsTopic, now: NOW });
  const base = composeDocument({ ai: goodAi(), pack, topic: basicsTopic, catalogue }).document;
  const clean = validateAiDocument({ document: base, pack });
  assert.equal(blockingCount(clean), 0, JSON.stringify(clean));
  assert.ok(clean.some(i => i.code === 'source_without_fetch_time'));
  const edit = (mutate) => { const d = structuredClone(base); mutate(d); return validateAiDocument({ document: d, pack }).filter(i => i.level === 'blocking').map(i => i.code); };
  assert.deepEqual(edit(d => { d.blocks[2].data.text = '1コース1着率は61.5%です。'; }), ['unsupported_number']);
  assert.deepEqual(edit(d => { d.blocks[2].data.text = '1コース1着率は52.2%です。'; delete d.blocks[2].data.source_url; }), ['missing_source']);
  assert.deepEqual(edit(d => { d.blocks[2].data.text = 'ここは絶対イン。'; }), ['banned_phrase']);
  assert.deepEqual(edit(d => { d.blocks[2].data.text = '詳しくは https://evil.example/ へ'; }), ['unknown_url']);
  assert.deepEqual(edit(d => { d.title = '桐生で2019年に起きたこと'; }), ['unsupported_date']); // a year is checked as a date
  assert.deepEqual(edit(d => { d.title = '桐生で2019件の記録'; }), ['unsupported_number']);
  assert.deepEqual(edit(d => { d.blocks[2].data.text = '3コースや5号艇、12Rまで、24場それぞれ確認します。'; }), []);
  assert.deepEqual(edit(d => { d.blocks[2].data.text = '５２．２％'; }), []); // full-width digits normalise to a known, cited value
});

test('pipeline: topic → sources → AI → cover → draft with provenance; never releases', async () => {
  const store = memoryStore(), repo = memoryRepo();
  let aiCalls = 0;
  const result = await runDraftPipeline({ topicId: basicsTopic.id, store, repo, renderCover: fakeCover, now: NOW, config: {},
    fetchImpl: fakeFetch({ default: { body: html('桐生の場データのページです。コース別の成績などを掲載しています。') } }),
    callAi: async ({ schema, instructions, input }) => { aiCalls++; assert.equal(schema, ARTICLE_SCHEMA); assert.match(instructions, /一果/); assert.match(input, /52\.2/); return { data: goodAi(), model: 'test-model' }; } });
  assert.equal(aiCalls, 1); assert.equal(repo.calls.release, 0); assert.equal(result.blocking, 0);
  const draft = store.state.drafts.get(result.post_id);
  assert.equal(draft.model, 'test-model'); assert.equal(draft.validated_version, 1); assert.equal(draft.prompt_version, 'blog-ai-v8');
  assert.ok(draft.source_pack.sources.some(s => s.fetched_at === NOW().toISOString()), 'fetched official page recorded with its time');
  assert.equal(store.state.documents.length, 1); assert.equal(store.state.media.length, 1);
  assert.equal(store.state.topics.get(basicsTopic.id).status, 'drafted');
  await assert.rejects(() => runDraftPipeline({ topicId: basicsTopic.id, store, repo, renderCover: fakeCover, now: NOW, fetchImpl: fakeFetch({}), callAi: async () => assert.fail('no AI') }), /すでに下書き化/);
});

test('pipeline stops before the AI when official text is missing or a near-duplicate exists', async () => {
  const noAi = async () => assert.fail('AI must not be called');
  await assert.rejects(() => runDraftPipeline({ topicId: charmTopic.id, store: memoryStore(), repo: memoryRepo(), renderCover: fakeCover, now: NOW, fetchImpl: fakeFetch({ default: { status: 404 } }), callAi: noAi }), e => e.status === 422);
  await assert.rejects(() => runDraftPipeline({ topicId: basicsTopic.id, store: memoryStore({ titles: [{ title: '桐生の水面と干満差' }] }), repo: memoryRepo(), renderCover: fakeCover, now: NOW, fetchImpl: fakeFetch({}), callAi: noAi }), e => e.status === 409 && /よく似た記事/.test(e.message));
});

test('a cover failure does not lose the draft; it is reported for review', async () => {
  const store = memoryStore();
  const result = await runDraftPipeline({ topicId: basicsTopic.id, store, repo: memoryRepo(), now: NOW, fetchImpl: fakeFetch({ default: { body: html('桐生の場データのページです。コース別の成績などを掲載しています。') } }),
    renderCover: async () => { throw new Error('render failed'); }, callAi: async () => ({ data: goodAi(), model: 'm' }) });
  assert.ok(result.issues.some(i => i.code === 'cover_failed'));
});

test('approval re-validates the exact version, records name + session, and refuses blocking issues', async () => {
  const store = memoryStore(), repo = memoryRepo();
  const { post_id } = await runDraftPipeline({ topicId: basicsTopic.id, store, repo, renderCover: fakeCover, now: NOW, fetchImpl: fakeFetch({ default: { body: html('桐生の場データのページです。コース別の成績などを掲載しています。') } }), callAi: async () => ({ data: goodAi(), model: 'm' }) });
  const session = approverSession(`${Math.floor(Date.parse('2026-10-09T02:00:00Z') / 1000)}.abcdef`);
  assert.match(session.hash, /^[0-9a-f]{32}$/); assert.equal(session.loginAt, '2026-10-09T02:00:00.000Z');
  await assert.rejects(() => approveDraft({ repo, store, postId: post_id, version: 7, name: '山田', session }), e => e.status === 409);
  const post = repo.posts.get(post_id);
  post.document.blocks[2].data.text = '1コース1着率は70.0%です。';
  const refused = await approveDraft({ repo, store, postId: post_id, version: 1, name: '山田', session });
  assert.equal(refused.approved, false); assert.equal(store.state.approvals.length, 0); assert.equal(store.state.drafts.get(post_id).blocking_issues, 1);
  post.document.blocks[2].data.text = '1コース1着率は52.2%です。';
  const ok = await approveDraft({ repo, store, postId: post_id, version: 1, name: ' 山田 花子 ', session });
  assert.equal(ok.approved, true); assert.equal(store.state.approvals[0].approver_name, '山田 花子'); assert.equal(store.state.approvals[0].session.hash, session.hash);
  const status = await draftStatus({ repo, store, postId: post_id });
  assert.equal(status.approved_current, true);
  post.version = 2; // any later save moves the version
  assert.equal((await draftStatus({ repo, store, postId: post_id })).approved_current, false);
  assert.throws(() => approverName(''), /承認者名/); assert.throws(() => approverSession(''), /ログイン/);
});

test('OpenAI call uses a strict JSON schema and surfaces failures', async () => {
  let body;
  const fetchImpl = async (url, init) => { body = JSON.parse(init.body); return new Response(JSON.stringify({ model: 'gpt-x', output: [{ content: [{ type: 'output_text', text: '{"a":1}' }] }] }), { status: 200 }); };
  const r = await callOpenAIJson({ fetchImpl, apiKey: 'k', model: 'm', instructions: 'i', input: 'x', schema: ARTICLE_SCHEMA, schemaName: 'n' });
  assert.deepEqual(r, { data: { a: 1 }, model: 'gpt-x' });
  assert.equal(body.text.format.type, 'json_schema'); assert.equal(body.text.format.strict, true);
  await assert.rejects(() => callOpenAIJson({ fetchImpl: async () => new Response('{}', { status: 500 }), apiKey: 'k', model: 'm', instructions: 'i', input: 'x', schema: {}, schemaName: 'n' }), /500/);
  await assert.rejects(() => callOpenAIJson({ fetchImpl: async () => new Response(JSON.stringify({ output_text: 'not json' }), { status: 200 }), apiKey: 'k', model: 'm', instructions: 'i', input: 'x', schema: {}, schemaName: 'n' }), /JSON/);
  await assert.rejects(() => callOpenAIJson({ apiKey: '', model: 'm' }), /OPENAI_API_KEY/);
});

test('cover template uses a registered character pose and renders a 1200x630 PNG', async () => {
  assert.throws(() => coverSpec({ title: 'x', categoryName: 'c', character: 'ichimaru' }), /キャラクター/);
  const spec = coverSpec({ title: 'Kiryu basics', categoryName: 'STADIUM BASICS', stadiumName: 'KIRYU', character: 'ichika' });
  assert.match(spec.imagePath, /^\/anime\/ichika\//); assert.match(spec.source, /既存キャラクター素材/);
  const png = await renderCoverPng(spec);
  assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  const view = new DataView(png.buffer, png.byteOffset); assert.equal(view.getUint32(16), 1200); assert.equal(view.getUint32(20), 630);
});

test('before the AI migration, posts are treated as non-AI instead of failing', async () => {
  const { aiStore } = await import('../../lib/blog/ai/store.mjs');
  const missing = { from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: null, error: { code: 'PGRST205' } }) }) }) }) };
  assert.equal(await aiStore(missing).aiDraft(randomUUID()), null);
  const broken = { from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: null, error: Object.assign(new Error('boom'), { code: '500' }) }) }) }) }) };
  await assert.rejects(() => aiStore(broken).aiDraft(randomUUID()), /boom/);
});
