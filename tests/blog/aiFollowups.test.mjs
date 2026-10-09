import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NOW, basicsTopic, goodAi, memoryStore, memoryRepo, fakeCover, html, fakeFetch } from './_aiFixtures.mjs';
import { runDraftPipeline } from '../../lib/blog/ai/pipeline.mjs';
import { approveDraft, draftStatus } from '../../lib/blog/ai/approval.mjs';
import { addManualSource, validateManualSource, withManualSources } from '../../lib/blog/ai/manualSources.mjs';
import { validateAiDocument, blockingCount } from '../../lib/blog/ai/validate.mjs';
import { approvedSnapshot, generateDerivatives, validateDerivative, SOCIAL_SCHEMA } from '../../lib/blog/ai/derivatives.mjs';
import { scheduleConfig, nextAutoTopic, runScheduledDrafts } from '../../lib/blog/ai/schedule.mjs';
import { regenerateCover } from '../../lib/blog/ai/coverRegen.mjs';

const session = { hash: 'a'.repeat(32), loginAt: NOW().toISOString() };
const officialPage = () => fakeFetch({ default: { body: html('桐生の場データのページです。コース別の成績などを掲載しています。') } });
async function drafted() {
  const store = memoryStore(), repo = memoryRepo();
  const r = await runDraftPipeline({ topicId: basicsTopic.id, store, repo, renderCover: fakeCover, now: NOW, fetchImpl: officialPage(), callAi: async () => ({ data: goodAi(), model: 'm' }) });
  return { store, repo, postId: r.post_id, post: repo.posts.get(r.post_id) };
}
const blockOf = (post, type) => post.document.blocks.findIndex(b => b.type === type && !b.data.placement);

test('manual source: validated input, recorded with check time, cited number becomes approvable', async () => {
  assert.throws(() => validateManualSource({ statement: 'x', source_label: 'y', source_url: 'http://a.example/', checked_at: NOW().toISOString(), registered_by: 'z' }, NOW), /https/);
  assert.throws(() => validateManualSource({ statement: 'x', source_label: 'y', source_url: 'https://a.example/', checked_at: '2030-01-01T00:00:00Z', registered_by: 'z' }, NOW), /未来/);
  const { store, repo, postId, post } = await drafted();
  const i = blockOf(post, 'TEXT');
  post.document.blocks[i].data.text = '場内の観覧席は1,200席あります。';
  post.document.blocks[i].data.source_url = 'https://www.kiryu.example/facility';
  let pack = withManualSources(store.state.drafts.get(postId).source_pack, store.state.manual);
  assert.deepEqual(validateAiDocument({ document: post.document, pack }).filter(x => x.level === 'blocking').map(x => x.code).sort(), ['unregistered_source', 'unsupported_number']);

  const added = await addManualSource({ repo, store, postId, version: post.version, now: NOW,
    input: { statement: '観覧席は1,200席', source_label: '桐生 公式サイト 施設案内', source_url: 'https://www.kiryu.example/facility', checked_at: '2026-10-09T01:30:00Z', registered_by: '山田' } });
  assert.equal(added.version, 2);
  const block = repo.posts.get(postId).document.blocks.at(-1);
  assert.equal(block.data.placement, 'sources'); assert.match(block.data.text, /取得日時 2026\/10\/09 10:30/); assert.match(block.data.text, /山田/);
  const result = await approveDraft({ repo, store, postId, version: 2, name: '山田', session });
  assert.equal(result.approved, true, JSON.stringify(result.issues));
  const status = await draftStatus({ repo, store, postId });
  assert.ok(status.sources.some(s => s.kind === 'manual' && s.fetched_at === '2026-10-09T01:30:00.000Z' && s.registered_by === '山田'));
  await assert.rejects(() => addManualSource({ repo, store, postId, version: 1, now: NOW, input: { statement: 'a', source_label: 'b', source_url: 'https://a.example/', checked_at: NOW().toISOString(), registered_by: 'c' } }), e => e.status === 409);
});

test('derivatives require an approved or sealed version and never add facts', async () => {
  const { store, repo, postId } = await drafted();
  await assert.rejects(() => approvedSnapshot({ repo, store, postId }), e => e.status === 409);
  await approveDraft({ repo, store, postId, version: 1, name: '山田', session });
  const snapshot = await approvedSnapshot({ repo, store, postId });
  assert.equal(snapshot.url, 'https://www.boat-strike.online/blog/articles/stadium-basics-kiryu-water'); assert.equal(snapshot.live, false);
  let seen;
  const callAi = async args => { seen = args; assert.equal(args.schema, SOCIAL_SCHEMA); return { model: 'm2', data: {
    x_post: '桐生の1コース1着率は52.2%。まずはここから確認しよう！', x_hashtags: ['#ボートレース', '桐生', 'bad tag'],
    yt_title: '桐生の水面をサクッと確認', yt_scenes: [{ speaker: 'ichika', line: '1コース1着率は52.2%だよ' }, { speaker: 'kiina', line: '外は？' }], yt_closing: '続きは記事で！' } }; };
  const out = await generateDerivatives({ snapshot, callAi, authorSlug: 'ichika' });
  assert.deepEqual(out.map(d => d.channel).sort(), ['note', 'x', 'youtube_description', 'youtube_script']);
  assert.match(seen.input, /52\.2/); assert.doesNotMatch(seen.input, /取得日時 記録なし/, 'system source lines are not sent to the AI');
  const by = Object.fromEntries(out.map(d => [d.channel, d]));
  assert.match(by.note.body, /元記事：https:\/\/www\.boat-strike\.online/); assert.match(by.note.body, /出典\n・BOAT RACE公式データ/);
  assert.equal(by.x.blocking_issues, 0, JSON.stringify(by.x.validation)); assert.match(by.x.body, /#ボートレース #桐生\n/); assert.doesNotMatch(by.x.body, /bad tag/);
  assert.match(by.youtube_script.body, /一果：1コース1着率は52\.2%だよ/); assert.equal(by.youtube_script.blocking_issues, 0);
  assert.ok(out.every(d => d.validation.some(v => v.code === 'not_published')));
  assert.equal(by.note.model, null); assert.equal(by.x.model, 'm2');
  assert.deepEqual(validateDerivative('勝率は61.5%、絶対来る https://evil.example/', snapshot.document, [snapshot.url]).map(i => i.code), ['unsupported_number', 'banned_phrase', 'unknown_url']);
  const long = await generateDerivatives({ snapshot, channels: ['x'], callAi: async () => ({ model: 'm', data: { x_post: 'あ'.repeat(130), x_hashtags: [], yt_title: '', yt_scenes: [], yt_closing: '' } }) });
  assert.ok(long[0].validation.some(v => v.code === 'too_long'));
  const noteOnly = await generateDerivatives({ snapshot, channels: ['note'], callAi: async () => assert.fail('note needs no AI') });
  assert.equal(noteOnly.length, 1);
});

test('derivatives for published human-written posts use the sealed revision', async () => {
  const store = memoryStore(), repo = memoryRepo();
  const id = randomUUID();
  repo.posts.set(id, { id, slug: 'human-post', version: 3, revision_id: 'rev-9', state: 'published', document: (await (async () => { const { post } = await drafted(); return post.document; })()) });
  store.state.posts = new Map([[id, { id, slug: 'human-post', state: 'published', editing_revision_id: null, scheduled_revision_id: null, published_revision_id: 'rev-9' }]]);
  const snap = await approvedSnapshot({ repo, store, postId: id });
  assert.equal(snap.live, true); assert.equal(snap.revisionId, 'rev-9');
  store.state.posts.get(id).editing_revision_id = 'rev-10';
  await assert.rejects(() => approvedSnapshot({ repo, store, postId: id }), e => e.status === 409);
});

test('schedule is off by default and needs both flags', () => {
  assert.equal(scheduleConfig({}).enabled, false);
  assert.equal(scheduleConfig({ BLOG_AI_SCHEDULE_ENABLED: 'true' }).enabled, false);
  const on = scheduleConfig({ BLOG_AI_DRAFTS_ENABLED: 'true', BLOG_AI_SCHEDULE_ENABLED: 'true', BLOG_AI_SCHEDULE_MAX_PER_RUN: '9', BLOG_AI_SCHEDULE_CATEGORIES: 'stadium-basics,news,stadiums' });
  assert.deepEqual([on.enabled, on.maxPerRun, on.autoTopics, on.categories], [true, 1, false, ['stadium-basics', 'stadiums']]);
  const t = nextAutoTopic({ existingKeys: ['stadium-basics:kiryu:water'], categories: ['stadium-basics'], now: NOW });
  assert.equal(t.topic_key, 'stadium-basics:kiryu:course');
});

test('scheduled run: disabled is a no-op; enabled drafts queued topics, logs runs, skips recent failures, never publishes', async () => {
  const store = memoryStore(), repo = memoryRepo();
  const deps = { store, repo, renderCover: fakeCover, now: NOW, fetchImpl: officialPage() };
  assert.deepEqual(await runScheduledDrafts({ ...deps, callAi: async () => assert.fail(), schedule: { enabled: false } }), { status: 'disabled', created: [] });
  assert.equal(store.state.runs.length, 0);
  const schedule = { enabled: true, maxPerRun: 3, autoTopics: false, categories: ['stadium-basics'] };
  const result = await runScheduledDrafts({ ...deps, schedule, callAi: async ({ instructions }) => {
    if (instructions.includes('24場の魅力')) throw Object.assign(new Error('AIの呼び出しに失敗しました（500）。'), { status: 502 });
    return { data: goodAi(), model: 'm' }; } });
  // basics topic succeeds; the charm topic's AI call fails, is logged, and is not retried in the same run
  assert.equal(result.created.length, 1); assert.equal(result.failed.length, 1); assert.equal(repo.calls.release, 0);
  assert.deepEqual(store.state.runs.map(r => [r.trigger, r.status]).sort(), [['schedule', 'failed'], ['schedule', 'succeeded']]);
  const again = await runScheduledDrafts({ ...deps, schedule, callAi: async () => assert.fail('nothing left to draft') });
  assert.equal(again.status, 'idle');
  store.state.runs.push({ id: randomUUID(), status: 'running', started_at: NOW().toISOString() });
  assert.equal((await runScheduledDrafts({ ...deps, schedule, callAi: async () => assert.fail() })).status, 'skipped');
});

test('scheduled run with automatic topics registers the next rotation topic', async () => {
  const store = memoryStore(), repo = memoryRepo();
  for (const t of store.state.topics.values()) t.status = 'drafted';
  const r = await runScheduledDrafts({ store, repo, renderCover: fakeCover, now: NOW, fetchImpl: officialPage(), callAi: async () => ({ data: { ...goodAi(), title: '桐生のコース別1着率を確認する' }, model: 'm' }),
    schedule: { enabled: true, maxPerRun: 1, autoTopics: true, categories: ['stadium-basics'] } });
  assert.equal(r.created.length, 1);
  assert.ok([...store.state.topics.values()].some(t => t.topic_key === 'stadium-basics:kiryu:course' && t.status === 'drafted'));
});

test('cover regeneration replaces cover and OGP in one save and requires re-approval', async () => {
  const { store, repo, postId } = await drafted();
  await approveDraft({ repo, store, postId, version: 1, name: '山田', session });
  assert.equal((await draftStatus({ repo, store, postId })).approved_current, true);
  let rendered;
  const r = await regenerateCover({ repo, store, postId, version: 1, character: 'kiina', pose: 'pose1', renderCover: async spec => { rendered = spec; return fakeCover(); } });
  const doc = repo.posts.get(postId).document;
  assert.equal(doc.cover.media_id, r.media_id); assert.equal(doc.seo.og_media_id, r.media_id); assert.match(doc.seo.og_alt, /キイナ/);
  assert.equal(rendered.character, 'kiina'); assert.equal(rendered.chip, '桐生'); assert.equal(store.state.drafts.get(postId).cover_media_id, r.media_id);
  assert.equal((await draftStatus({ repo, store, postId })).approved_current, false, 'approval no longer matches after the save');
  await assert.rejects(() => regenerateCover({ repo, store, postId, version: 1, renderCover: fakeCover }), e => e.status === 409);
  const r2 = await regenerateCover({ repo, store, postId, version: r.version, renderCover: async spec => { rendered = spec; return fakeCover(); } });
  assert.equal(rendered.character, 'ichika', 'defaults to the article author'); assert.ok(r2.version > r.version);
});
