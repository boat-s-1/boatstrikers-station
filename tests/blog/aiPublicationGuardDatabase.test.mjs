import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { blankDocument } from '../../lib/blog/document.mjs';
import { REQUIRED_GATES } from '../../lib/blog/ai/gates.mjs';
const require = createRequire(new URL('../../scripts/blog/package.json', import.meta.url));
const { PGlite } = require('@electric-sql/pglite');

// PHASE 2: no publication path (immediate release, reservation, reserved-publication worker, direct row update,
// automatic publication) can bypass the gates; one automatic publication per JST day; daily job states and leases.
let db, author, category;
const MIGRATIONS = ['20261002141712_blog_media_platform.sql', '20261003174612_blog_private_media_publication.sql',
  '20261009180000_blog_ai_drafts.sql', '20261010090000_blog_ai_followups.sql', '20261103120000_blog_ai_quality_gates.sql'];
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
async function role(name, fn) { await db.exec(`set role ${name}`); try { return await fn(); } finally { await db.exec('reset role'); } }
async function rpc(name, args = [], types = []) {
  return role('service_role', async () => (await q(`select public.${name}(${args.map((_, i) => `$${i + 1}${types[i] ? '::' + types[i] : ''}`).join(',')}) as result`, args))[0].result);
}
const migration = name => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const doc = title => ({ ...blankDocument(), title, category_id: category, author_ids: [author], blocks: [{ id: randomUUID(), type: 'TEXT', data: { text: title } }] });
const create = title => rpc('blog_create_draft', [`ai-${randomUUID()}`, doc(title)], ['text', 'jsonb']);
const release = (post, at = null) => rpc('blog_release', [post.id, post.version, at], ['uuid', 'bigint', 'timestamptz']);
const approve = post => rpc('blog_ai_approve', [post.id, post.version, '編集 花子', 'a1b2c3d4e5f60718', new Date().toISOString()], ['uuid', 'bigint', 'text', 'text', 'timestamptz']);
const gates = verdict => Object.fromEntries(REQUIRED_GATES.map(k => [k, { verdict, issues: [] }]));
const record = (post, verdict = 'PASS') => rpc('blog_ai_record_gate_result', [post.id, post.version, 0, verdict, JSON.stringify(gates(verdict)), 'blog-gates-v1', '[]'],
  ['uuid', 'bigint', 'integer', 'text', 'jsonb', 'text', 'jsonb']);
const systemApprove = (post, gateId) => rpc('blog_ai_system_approve', [post.id, post.version, gateId], ['uuid', 'bigint', 'uuid']);
const autoPublish = (post, gateId) => rpc('blog_ai_auto_publish', [post.id, post.version, gateId], ['uuid', 'bigint', 'uuid']);
const settings = (mode, enabled, time = '00:00') => q('update public.blog_ai_settings set approval_mode=$1, auto_publish_enabled=$2, publish_time=$3::time', [mode, enabled, time]);
const state = async post => (await q('select state, published_revision_id, scheduled_revision_id from public.blog_posts where id=$1', [post.id]))[0];
const due = post => q("update public.blog_posts set scheduled_at=now()-interval '1 second' where id=$1", [post.id]);
const future = () => new Date(Date.now() + 3600000).toISOString();
const rejectsWith = (fn, message) => assert.rejects(fn, e => String(e.message).includes(message));
async function aiPost(title) {
  const post = await create(title);
  await role('service_role', () => q(`insert into public.blog_ai_drafts(post_id,model,prompt_version,source_pack,validated_version) values($1,'m','v','{}'::jsonb,$2)`, [post.id, post.version]));
  return post;
}
const jstDate = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

before(async () => {
  db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;');
  await db.exec('alter default privileges in schema public grant all on tables to anon,authenticated,service_role; alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;');
  for (const name of MIGRATIONS) await db.exec(migration(name));
  author = (await q("select id from public.blog_authors where slug='ichika'"))[0].id;
  category = (await q("select id from public.blog_categories where slug='inside-course'"))[0].id;
});
after(async () => await db?.close());

test('reservation bypass: a system-approved AI reservation is skipped after the emergency stop; other reservations still publish', async () => {
  await settings('auto', true);
  const ai = await aiPost('自動承認で予約');
  await systemApprove(ai, (await record(ai)).gate_result_id);
  await release(ai, future());
  const human = await create('人の記事の予約');
  await release(human, future());
  await settings('manual', false);
  await due(ai); await due(human);
  const promoted = await rpc('blog_publish_due');
  assert.deepEqual(promoted.map(p => p.id), [human.id], 'the stopped AI reservation is skipped, not published and not blocking');
  assert.equal((await state(ai)).state, 'draft');
  assert.ok((await state(ai)).scheduled_revision_id, 'it stays reserved (overdue) until someone cancels it');
  // Turning automatic publication back on lets the worker publish it on the next tick.
  await settings('auto', true);
  assert.deepEqual((await rpc('blog_publish_due')).map(p => p.id), [ai.id]);
  await settings('manual', false);
});

test('a human-approved AI reservation still publishes through the worker (manual mode unchanged)', async () => {
  const ai = await aiPost('人が承認して予約');
  await approve(ai);
  await release(ai, future());
  await due(ai);
  assert.deepEqual((await rpc('blog_publish_due')).map(p => p.id), [ai.id]);
  assert.equal((await state(ai)).state, 'published');
});

test('a HOLD verdict cannot be approved away: human release and reservation of that version are refused', async () => {
  const held = await aiPost('HOLDの記事');
  await record(held, 'HOLD');
  await approve(held);
  await rejectsWith(() => release(held), 'BLOG_AI_PUBLICATION_NOT_ALLOWED');
  await rejectsWith(() => release(held, future()), 'BLOG_AI_PUBLICATION_NOT_ALLOWED');
  assert.equal((await state(held)).state, 'draft');
  // A later PASS for the same version (re-checked) lifts it; RETRY does not block a human approval.
  const retried = await aiPost('RETRYの記事');
  await record(retried, 'RETRY');
  await approve(retried);
  assert.equal((await release(retried)).action, 'publish');
});

test('direct row updates by a privileged role cannot publish or reserve an unapproved AI draft', async () => {
  const ai = await aiPost('直接更新');
  const rev = (await q('select editing_revision_id from public.blog_posts where id=$1', [ai.id]))[0].editing_revision_id;
  await rejectsWith(() => role('service_role', () => q("update public.blog_posts set state='published', published_revision_id=$2 where id=$1", [ai.id, rev])), 'BLOG_AI_PUBLICATION_NOT_ALLOWED');
  await rejectsWith(() => role('service_role', () => q("update public.blog_posts set scheduled_revision_id=$2, scheduled_at=now() where id=$1", [ai.id, rev])), 'BLOG_AI_PUBLICATION_NOT_ALLOWED');
  // Articles that are not AI drafts are not affected by the guard.
  const human = await create('人の記事');
  assert.equal((await release(human)).action, 'publish');
});

test('automatic publication: off, before the publication time, then once per JST day, all-or-nothing', async () => {
  const a = await aiPost('自動公開A'), b = await aiPost('自動公開B');
  const ga = (await record(a)).gate_result_id, gb = (await record(b)).gate_result_id;
  await settings('manual', false);
  await rejectsWith(() => autoPublish(a, ga), 'BLOG_AI_AUTO_PUBLISH_DISABLED');
  await settings('auto', true, '23:59:59');
  // Only if the test does not run in the last second of a JST day.
  if (new Date(Date.now() + 9 * 3600000).toISOString().slice(11, 19) < '23:59:59') await rejectsWith(() => autoPublish(a, ga), 'BLOG_AI_BEFORE_PUBLISH_TIME');
  await settings('auto', true, '00:00');
  const r = await autoPublish(a, ga);
  assert.equal(r.publish_date, jstDate());
  assert.equal((await state(a)).state, 'published');
  await rejectsWith(() => autoPublish(b, gb), 'BLOG_AI_ALREADY_PUBLISHED_TODAY');
  assert.equal((await state(b)).state, 'draft');
  assert.equal((await q("select count(*)::int n from public.blog_ai_approvals where post_id=$1", [b.id]))[0].n, 0, 'the refused run left no approval');
  await rejectsWith(() => q('delete from public.blog_ai_auto_publications'), 'BLOG_AI_AUTO_PUBLICATION_IMMUTABLE');
  await settings('manual', false);
});

test('automatic publication refuses content changed just before publication and leaves nothing behind', async () => {
  await q('delete from public.blog_ai_auto_publications').catch(() => {});
  const c = await aiPost('直前に本文変更');
  const g = (await record(c)).gate_result_id;
  await q("update public.blog_post_revisions set title='直前の書き換え' where id=(select editing_revision_id from public.blog_posts where id=$1)", [c.id]);
  await settings('auto', true, '00:00');
  // The day's slot may already be used by the previous test; either refusal leaves the post unpublished.
  await assert.rejects(() => autoPublish(c, g), e => /BLOG_AI_CONTENT_CHANGED|BLOG_AI_ALREADY_PUBLISHED_TODAY/.test(e.message));
  assert.equal((await state(c)).state, 'draft');
  assert.equal((await q("select count(*)::int n from public.blog_ai_approvals where post_id=$1", [c.id]))[0].n, 0);
  await settings('manual', false);
});

test('daily jobs: one row per date, a lease blocks a second runner, transitions are checked, at most two regenerations', async () => {
  const day = '2030-01-01';
  const claim = owner => rpc('blog_ai_job_claim', [day, 'ichika', owner, 600], ['date', 'text', 'text', 'integer']);
  const move = (owner, to, patch = {}) => rpc('blog_ai_job_transition', [day, owner, to, JSON.stringify(patch)], ['date', 'text', 'text', 'jsonb']);
  const first = await claim('run-a');
  assert.equal(first.claimed, true);
  assert.equal(first.job.state, 'PLANNED');
  const second = await claim('run-b');
  assert.deepEqual([second.claimed, second.reason], [false, 'leased'], 'a concurrent run does not start the same day');
  await rejectsWith(() => move('run-b', 'GENERATING'), 'BLOG_AI_JOB_NOT_LEASED');
  await rejectsWith(() => move('run-a', 'PUBLISHED'), 'BLOG_AI_JOB_INVALID_TRANSITION');
  for (const to of ['GENERATING', 'GENERATED', 'VALIDATING', 'RETRY', 'GENERATING', 'GENERATED', 'VALIDATING', 'RETRY', 'GENERATING', 'GENERATED', 'VALIDATING', 'RETRY']) await move('run-a', to);
  assert.equal((await q('select attempt from public.blog_ai_jobs where publish_date=$1', [day]))[0].attempt, 2);
  await rejectsWith(() => move('run-a', 'GENERATING'), 'check', 'a third regeneration is impossible');
  await move('run-a', 'HOLD', { last_error: '再生成の上限' });
  const done = await claim('run-c');
  assert.deepEqual([done.claimed, done.reason], [false, 'finished']);
  const job = (await q('select state, lease_owner, last_error, jsonb_array_length(history) n from public.blog_ai_jobs where publish_date=$1', [day]))[0];
  assert.deepEqual(job, { state: 'HOLD', lease_owner: null, last_error: '再生成の上限', n: 13 });
  // The holder gives the lease back at the end of a run; then another runner can continue at once.
  await rpc('blog_ai_job_claim', ['2030-01-03', 'hatsune', 'run-e', 600], ['date', 'text', 'text', 'integer']);
  assert.equal(await rpc('blog_ai_job_release', ['2030-01-03', 'run-x'], ['date', 'text']), false, 'only the holder can release');
  assert.equal(await rpc('blog_ai_job_release', ['2030-01-03', 'run-e'], ['date', 'text']), true);
  assert.equal((await rpc('blog_ai_job_claim', ['2030-01-03', 'hatsune', 'run-f', 600], ['date', 'text', 'text', 'integer'])).claimed, true);
  // An expired lease can be taken over.
  await q("insert into public.blog_ai_jobs(publish_date, character_key, lease_owner, lease_until) values ('2030-01-02','kiina','crashed', now()-interval '1 minute')");
  assert.equal((await rpc('blog_ai_job_claim', ['2030-01-02', 'kiina', 'run-d', 600], ['date', 'text', 'text', 'integer'])).claimed, true);
});

test('new tables and functions are private to service_role', async () => {
  for (const r of ['anon', 'authenticated']) {
    for (const t of ['blog_ai_auto_publications', 'blog_ai_jobs']) await assert.rejects(role(r, () => q(`select * from public.${t}`)), /permission denied/);
    for (const fn of ['blog_ai_auto_publish(uuid,bigint,uuid)', 'blog_ai_release_allowed(uuid,uuid)', 'blog_ai_job_claim(date,text,text,integer)', 'blog_ai_job_transition(date,text,text,jsonb)', 'blog_publish_due(integer)']) {
      assert.equal((await q(`select has_function_privilege($1, 'public.${fn}', 'EXECUTE') as ok`, [r]))[0].ok, false, `${r} ${fn}`);
    }
  }
});
