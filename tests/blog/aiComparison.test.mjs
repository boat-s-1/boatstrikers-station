import test from 'node:test';
import assert from 'node:assert/strict';
import { NOW, basicsTopic, charmTopic, goodAi, memoryStore, memoryRepo, fakeCover, fakeFetch, html } from './_aiFixtures.mjs';
import { runDraftPipeline } from '../../lib/blog/ai/pipeline.mjs';
import { runScheduledDrafts } from '../../lib/blog/ai/schedule.mjs';
import { approveDraft, approverSession, draftStatus } from '../../lib/blog/ai/approval.mjs';
import { validateAiDocument, blockingCount } from '../../lib/blog/ai/validate.mjs';
import { assertNotComparison, comparisonSlug, COMPARISON_MESSAGE } from '../../lib/blog/ai/comparison.mjs';
import { PROMPT_VERSION } from '../../lib/blog/ai/config.mjs';

const session = approverSession(`${Math.floor(Date.parse('2026-10-09T02:00:00Z') / 1000)}.abcdef`);
const fetchImpl = fakeFetch({ default: { body: html('桐生の場データのページです。コース別の成績などを掲載しています。') } });

// One theme drafted the usual way (the original), with the store able to look the repository's slugs up.
async function drafted() {
  const store = memoryStore(), repo = memoryRepo();
  store.state.repoPosts = repo.posts;
  let calls = 0;
  const callAi = async () => { calls++; return { data: goodAi(), model: 'test-model' }; };
  const original = await runDraftPipeline({ topicId: basicsTopic.id, store, repo, renderCover: fakeCover, now: NOW, fetchImpl, callAi });
  return { store, repo, original, callAi, aiCalls: () => calls };
}
const regenerate = (deps, callAi = deps.callAi) => runDraftPipeline({ topicId: basicsTopic.id, store: deps.store, repo: deps.repo, renderCover: fakeCover, now: NOW, fetchImpl, callAi, comparison: true });

test('comparison: a second draft of a drafted theme is made under its own slug; the original and the theme stay as they were', async () => {
  const deps = await drafted();
  const { store, repo, original } = deps;
  // The original approved, so its approval record is part of what must stay untouched.
  assert.equal((await approveDraft({ repo, store, postId: original.post_id, version: 1, name: '山田', session })).approved, true);
  const before = structuredClone({ topic: store.state.topics.get(basicsTopic.id), draft: store.state.drafts.get(original.post_id), post: repo.posts.get(original.post_id), approvals: store.state.approvals });

  const result = await regenerate(deps);
  assert.equal(deps.aiCalls(), 2);
  assert.equal(result.slug, `stadium-basics-kiryu-water-${PROMPT_VERSION.replace('blog-ai-', '')}`);
  assert.equal(result.slug, comparisonSlug(basicsTopic));
  assert.equal(result.comparison, true);
  assert.notEqual(result.post_id, original.post_id);
  assert.deepEqual(structuredClone({ topic: store.state.topics.get(basicsTopic.id), draft: store.state.drafts.get(original.post_id), post: repo.posts.get(original.post_id), approvals: store.state.approvals }), before,
    'theme status and post, original draft, its sources and approvals are unchanged');

  const draft = store.state.drafts.get(result.post_id);
  assert.equal(draft.topic_id, basicsTopic.id); assert.equal(draft.prompt_version, PROMPT_VERSION);
  assert.deepEqual(draft.source_pack.comparison, { of_post_id: original.post_id, of_slug: 'stadium-basics-kiryu-water', of_prompt_version: PROMPT_VERSION,
    topic_key: basicsTopic.topic_key, prompt_version: PROMPT_VERSION, created_at: NOW().toISOString() });
  assert.ok(draft.blocking_issues >= 1, 'stored with a blocking issue, which the database refuses to approve');
  assert.ok(draft.validation.some(i => i.code === 'comparison_draft' && i.level === 'blocking'));
  // The theme still leads to the original post.
  assert.equal(store.state.topics.get(basicsTopic.id).post_id, original.post_id);
});

test('comparison: an existing slug stops before the AI is called (409) and nothing is overwritten', async () => {
  const deps = await drafted();
  await regenerate(deps);
  const posts = deps.repo.posts.size, drafts = structuredClone([...deps.store.state.drafts.entries()]);
  await assert.rejects(() => regenerate(deps, async () => assert.fail('AI must not be called')), e => e.status === 409 && /すでにあります。比較用の下書きは上書きしません/.test(e.message));
  assert.equal(deps.repo.posts.size, posts);
  assert.deepEqual(structuredClone([...deps.store.state.drafts.entries()]), drafts);
  // The database's unique slug is the last guard, should the pre-check miss a concurrent creation.
  const store = memoryStore(), repo = memoryRepo();
  store.state.topics.get(basicsTopic.id).status = 'drafted';
  store.state.topics.get(basicsTopic.id).post_id = 'original';
  await repo.create(comparisonSlug(basicsTopic), { ...(await deps.repo.editor(deps.original.post_id)).document });
  await assert.rejects(() => runDraftPipeline({ topicId: basicsTopic.id, store, repo, renderCover: fakeCover, now: NOW, fetchImpl, callAi: deps.callAi, comparison: true }), e => e.status === 409);
});

test('comparison: only themes already drafted; candidate and rejected themes are refused', async () => {
  const store = memoryStore(), repo = memoryRepo();
  const noAi = async () => assert.fail('AI must not be called');
  await assert.rejects(() => runDraftPipeline({ topicId: basicsTopic.id, store, repo, renderCover: fakeCover, now: NOW, fetchImpl, callAi: noAi, comparison: true }), e => e.status === 409 && /下書き作成済みのテーマだけ/.test(e.message));
  store.state.topics.get(charmTopic.id).status = 'rejected';
  await assert.rejects(() => runDraftPipeline({ topicId: charmTopic.id, store, repo, renderCover: fakeCover, now: NOW, fetchImpl, callAi: noAi, comparison: true }), e => e.status === 409);
  assert.equal(repo.posts.size, 0);
});

test('comparison drafts cannot be approved, published or scheduled; the original keeps the usual approval and publication', async () => {
  const deps = await drafted();
  const { store, repo, original } = deps;
  const copy = await regenerate(deps);
  // Approval: refused before anything is recorded.
  await assert.rejects(() => approveDraft({ repo, store, postId: copy.post_id, version: 1, name: '山田', session }), e => e.status === 409 && e.message === COMPARISON_MESSAGE);
  assert.equal(store.state.approvals.length, 0);
  // Publication and scheduling: the release route's server-side check (the database refuses without an approval too).
  for (const action of ['公開', '予約公開']) await assert.rejects(() => assertNotComparison({ store, postId: copy.post_id, action }), e => e.status === 409 && e.message.includes(action));
  // Edited content does not remove the mark: it is part of the source pack, which the editor cannot change.
  const edited = await repo.editor(copy.post_id);
  edited.document.blocks = edited.document.blocks.filter(b => b.type !== 'DIALOGUE_SCENE');
  await repo.save(copy.post_id, 1, edited.document);
  const status = await draftStatus({ repo, store, postId: copy.post_id });
  assert.equal(status.comparison.of_post_id, original.post_id);
  assert.ok(status.live_blocking >= 1); assert.equal(status.validation[0].code, 'comparison_draft');
  assert.match(status.validation[0].message, /元記事：\/stadium-basics-kiryu-water/);
  // The original: approved and releasable as before.
  await assertNotComparison({ store, postId: original.post_id, action: '公開' });
  const approved = await approveDraft({ repo, store, postId: original.post_id, version: 1, name: '山田', session });
  assert.equal(approved.approved, true);
  const originalStatus = await draftStatus({ repo, store, postId: original.post_id });
  assert.equal(originalStatus.comparison, null); assert.equal(originalStatus.approved_current, true);
  assert.ok(!originalStatus.validation.some(i => i.code === 'comparison_draft'));
  // Posts without an AI draft (human-written) pass the check unchanged.
  await assertNotComparison({ store, postId: 'human-post', action: '公開' });
});

test('comparison drafts stay out of scheduled generation, and lookups by post never pick the wrong article', async () => {
  const deps = await drafted();
  const { store, repo, original } = deps;
  const copy = await regenerate(deps);
  store.state.topics.get(charmTopic.id).status = 'rejected';
  const result = await runScheduledDrafts({ store, repo, renderCover: fakeCover, now: NOW, fetchImpl, callAi: async () => assert.fail('nothing to generate'), schedule: { enabled: true, maxPerRun: 1, autoTopics: false, categories: ['stadium-basics'] } });
  assert.deepEqual(result, { status: 'idle', created: [], failed: [] });
  assert.equal(repo.posts.size, 2);
  // Two posts of one theme: each is found by its own id; the theme still points to the original.
  assert.equal((await store.aiDraft(original.post_id)).source_pack.comparison, undefined);
  assert.equal((await store.aiDraft(copy.post_id)).source_pack.comparison.of_post_id, original.post_id);
  assert.equal((await repo.editor(original.post_id)).slug, 'stadium-basics-kiryu-water');
  assert.equal((await repo.editor(copy.post_id)).slug, comparisonSlug(basicsTopic));
  assert.equal((await store.topic(basicsTopic.id)).post_id, original.post_id);
  // Validation of the original is not affected by the comparison draft's mark.
  const originalDraft = await store.aiDraft(original.post_id);
  assert.equal(blockingCount(validateAiDocument({ document: (await repo.editor(original.post_id)).document, pack: originalDraft.source_pack })), 0);
});
