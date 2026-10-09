import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { blankDocument } from '../../lib/blog/document.mjs';
const require = createRequire(new URL('../../scripts/blog/package.json', import.meta.url));
const { PGlite } = require('@electric-sql/pglite');
let db, author, category;
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
async function role(name, fn) { await db.exec(`set role ${name}`); try { return await fn(); } finally { await db.exec('reset role'); } }
async function rpc(name, args = [], types = []) {
  return role('service_role', async () => (await q(`select public.${name}(${args.map((_, i) => `$${i + 1}${types[i] ? '::' + types[i] : ''}`).join(',')}) as result`, args))[0].result);
}
const migration = name => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const doc = title => ({ ...blankDocument(), title, category_id: category, author_ids: [author], blocks: [{ id: randomUUID(), type: 'TEXT', data: { text: title } }] });
const create = title => rpc('blog_create_draft', [`ai-${randomUUID()}`, doc(title)], ['text', 'jsonb']);
const save = (post, title) => rpc('blog_save_draft', [post.id, post.version, doc(title)], ['uuid', 'bigint', 'jsonb']);
const release = (post, at = null) => rpc('blog_release', [post.id, post.version, at], ['uuid', 'bigint', 'timestamptz']);
const session = 'a1b2c3d4e5f60718';
const approve = (post, name = '編集 太郎') => rpc('blog_ai_approve', [post.id, post.version, name, session, new Date().toISOString()], ['uuid', 'bigint', 'text', 'text', 'timestamptz']);
async function markAi(post, { validatedVersion = post.version, blocking = 0 } = {}) {
  await role('service_role', () => q(`insert into public.blog_ai_drafts(post_id,model,prompt_version,source_pack,validated_version,blocking_issues)
    values($1,'test-model','test-v1','{"facts":[]}'::jsonb,$2,$3)
    on conflict (post_id) do update set validated_version=excluded.validated_version, blocking_issues=excluded.blocking_issues`, [post.id, validatedVersion, blocking]));
}
const rejectsWith = (fn, message) => assert.rejects(fn, e => String(e.message).includes(message));

before(async () => {
  db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;');
  await db.exec('alter default privileges in schema public grant all on tables to anon,authenticated,service_role; alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;');
  for (const name of ['20261002141712_blog_media_platform.sql', '20261003174612_blog_private_media_publication.sql', '20261009180000_blog_ai_drafts.sql', '20261010090000_blog_ai_followups.sql']) await db.exec(migration(name));
  author = (await q("select id from public.blog_authors where slug='ichika'"))[0].id;
  category = (await q("select id from public.blog_categories where slug='stadium-basics'"))[0].id;
});
after(async () => await db?.close());

test('approved categories exist and DATA LAB keeps its slug with the new display name', async () => {
  const rows = await q("select slug,name from public.blog_categories where slug in ('stadium-charm','stadium-basics','characters','data-lab','stadiums') order by slug");
  assert.deepEqual(rows.map(r => [r.slug, r.name]), [
    ['characters', 'キャラクター'], ['data-lab', 'BoatStrikers DATA LAB'], ['stadium-basics', '24場の基本'], ['stadium-charm', '24場の魅力'], ['stadiums', '24場攻略'],
  ]);
});

test('an AI draft cannot be released, published now or scheduled, without an approval', async () => {
  const post = await create('AI 承認なし');
  await markAi(post);
  await rejectsWith(() => release(post), 'BLOG_AI_APPROVAL_REQUIRED');
  await rejectsWith(() => release(post, new Date(Date.now() + 3600000).toISOString()), 'BLOG_AI_APPROVAL_REQUIRED');
  assert.equal((await q('select state from public.blog_posts where id=$1', [post.id]))[0].state, 'draft');
});

test('approval of the current version allows release and the event records the approval', async () => {
  const post = await create('AI 承認あり');
  await markAi(post);
  const approval = await approve(post);
  assert.equal(approval.version, post.version);
  const released = await release(post);
  assert.equal(released.action, 'publish');
  const events = await q('select action, ai_approval_id from public.blog_publication_events where post_id=$1', [post.id]);
  assert.deepEqual(events, [{ action: 'publish', ai_approval_id: approval.approval_id }]);
  const stored = await q('select approver_name, approver_session, document_md5 from public.blog_ai_approvals where id=$1', [approval.approval_id]);
  assert.equal(stored[0].approver_name, '編集 太郎');
  assert.equal(stored[0].approver_session, session);
  assert.match(stored[0].document_md5, /^[0-9a-f]{32}$/);
});

test('editing after approval invalidates it; re-validation and re-approval are required', async () => {
  let post = await create('AI 承認後に修正');
  await markAi(post);
  await approve(post);
  post = { ...post, ...(await save(post, 'AI 承認後に修正（直した）')) };
  await rejectsWith(() => release(post), 'BLOG_AI_APPROVAL_REQUIRED');
  await rejectsWith(() => approve(post), 'BLOG_AI_NOT_VALIDATED');
  await markAi(post, { validatedVersion: post.version });
  await approve(post);
  assert.equal((await release(post)).action, 'publish');
});

test('blocking validation issues and stale versions prevent approval', async () => {
  const post = await create('AI 要確認あり');
  await markAi(post, { blocking: 2 });
  await rejectsWith(() => approve(post), 'BLOG_AI_BLOCKING_ISSUES');
  await rejectsWith(() => rpc('blog_ai_approve', [post.id, post.version + 5, '編集', session, null], ['uuid', 'bigint', 'text', 'text', 'timestamptz']), 'BLOG_EDIT_CONFLICT');
  await markAi(post, { blocking: 0 });
  await rejectsWith(() => approve(post, '   '), 'blog_ai_approvals');
});

test('human-written posts keep the existing release behaviour', async () => {
  const post = await create('人が書いた記事');
  assert.equal((await release(post)).action, 'publish');
  assert.equal((await q('select ai_approval_id from public.blog_publication_events where post_id=$1', [post.id]))[0].ai_approval_id, null);
  await rejectsWith(() => approve({ ...post, version: post.version + 1 }), 'BLOG_AI_NOT_AI_DRAFT');
});

test('approvals are append-only', async () => {
  const post = await create('AI 監査');
  await markAi(post);
  const { approval_id } = await approve(post);
  await rejectsWith(() => role('service_role', () => q('update public.blog_ai_approvals set approver_name=$2 where id=$1', [approval_id, '別人'])), 'BLOG_AI_APPROVAL_IMMUTABLE');
  await rejectsWith(() => role('service_role', () => q('delete from public.blog_ai_approvals where id=$1', [approval_id])), 'BLOG_AI_APPROVAL_IMMUTABLE');
});

test('new tables and RPCs are not reachable by anon or authenticated', async () => {
  for (const r of ['anon', 'authenticated']) {
    for (const table of ['blog_source_urls', 'blog_source_documents', 'blog_topics', 'blog_ai_drafts', 'blog_ai_approvals', 'blog_post_derivatives', 'blog_ai_manual_sources', 'blog_ai_runs'])
      await assert.rejects(() => role(r, () => q(`select * from public.${table}`)), e => e.code === '42501');
    await assert.rejects(() => role(r, () => q(`select public.blog_ai_approve('${randomUUID()}'::uuid,0,'x','${session}',null)`)), e => e.code === '42501');
  }
});

test('topic keys are unique and source documents record fetch time and outcome', async () => {
  await role('service_role', () => q("insert into public.blog_topics(topic_key,category_slug,stadium_slug,angle,title_hint) values('stadium-basics:kiryu:water','stadium-basics','kiryu','water','桐生の水面')"));
  await assert.rejects(() => role('service_role', () => q("insert into public.blog_topics(topic_key,category_slug,stadium_slug,angle,title_hint) values('stadium-basics:kiryu:water','stadium-basics','kiryu','water','重複')")), e => e.code === '23505');
  await assert.rejects(() => role('service_role', () => q("insert into public.blog_source_documents(stadium_slug,url,kind,fetched_at) values('kiryu','https://example.com/','manual',now())")), e => e.code === '23514');
  await assert.rejects(() => role('service_role', () => q("insert into public.blog_source_urls(stadium_slug,url,label,kind) values('kiryu','http://example.com/','x','manual')")), e => e.code === '23514');
});

test('follow-up tables enforce https sources, past check times, known channels and run states', async () => {
  const post = await create('AI 追記');
  const sr = sql => role('service_role', () => q(sql, [post.id]));
  await sr("insert into public.blog_ai_manual_sources(post_id,statement,source_label,source_url,checked_at,registered_by) values($1,'観覧席','公式','https://a.example/x',now()-interval '1 hour','山田')");
  await assert.rejects(() => sr("insert into public.blog_ai_manual_sources(post_id,statement,source_label,source_url,checked_at,registered_by) values($1,'x','y','http://a.example/','2020-01-01','z')"), e => e.code === '23514');
  await assert.rejects(() => sr("insert into public.blog_ai_manual_sources(post_id,statement,source_label,source_url,checked_at,registered_by) values($1,'x','y','https://a.example/',now()+interval '1 day','z')"), e => e.code === '23514');
  const rev = (await q('select editing_revision_id as r from public.blog_posts where id=$1', [post.id]))[0].r;
  await role('service_role', () => q("insert into public.blog_post_derivatives(post_id,revision_id,channel,body) values($1,$2,'x','本文')", [post.id, rev]));
  await assert.rejects(() => role('service_role', () => q("insert into public.blog_post_derivatives(post_id,revision_id,channel,body) values($1,$2,'instagram','本文')", [post.id, rev])), e => e.code === '23514');
  await role('service_role', () => q("insert into public.blog_ai_runs(trigger,status) values('schedule','skipped')"));
  await assert.rejects(() => role('service_role', () => q("insert into public.blog_ai_runs(trigger) values('auto')")), e => e.code === '23514');
});

test('content changed after approval without a version change is refused at release', async () => {
  const post = await create('AI 本文照合');
  await markAi(post);
  await approve(post);
  // Simulate a change that bypasses blog_save_draft (so edit_version and revision stay the same).
  await role('service_role', () => q("update public.blog_blocks set data = jsonb_set(data, '{text}', '\"差し替えられた本文\"') where revision_id = $1", [post.revision_id]));
  await rejectsWith(() => release(post), 'BLOG_AI_CONTENT_CHANGED');
  await role('service_role', () => q("update public.blog_post_revisions set title = 'タイトルだけ変更' where id = $1", [post.revision_id]));
  await rejectsWith(() => release(post), 'BLOG_AI_CONTENT_CHANGED');
  assert.equal((await q('select state from public.blog_posts where id=$1', [post.id]))[0].state, 'draft');
  // Re-validation + re-approval of the exact current content makes it releasable again.
  await approve(post);
  assert.equal((await release(post)).action, 'publish');
});

test('each approval stores the exact approved document; earlier approvals stay auditable after later edits', async () => {
  let post = await create('AI 監査用 v1');
  await markAi(post);
  const first = await approve(post);
  post = { ...post, ...(await save(post, 'AI 監査用 v2')) };
  await markAi(post, { validatedVersion: post.version });
  const second = await approve(post);
  const rows = await role('service_role', () => q('select id, document->>\'title\' as title, document_md5 = md5(document::text) as consistent from public.blog_ai_approvals where post_id=$1 order by created_at', [post.id]));
  assert.deepEqual(rows.map(r => [r.id, r.title, r.consistent]), [[first.approval_id, 'AI 監査用 v1', true], [second.approval_id, 'AI 監査用 v2', true]]);
  // The stored fingerprint is the one checked at release time.
  const md5 = (await role('service_role', () => q('select public.blog_ai_document_md5($1) as m', [post.id])))[0].m;
  assert.equal((await role('service_role', () => q('select document_md5 from public.blog_ai_approvals where id=$1', [second.approval_id])))[0].document_md5, md5);
  // A document that does not match its fingerprint cannot be recorded.
  await assert.rejects(() => role('service_role', () => q("insert into public.blog_ai_approvals(post_id,revision_id,edit_version,document_md5,document,approver_name,approver_session) values($1,$2,1,$3,'{\"title\":\"x\"}'::jsonb,'n','abcdef0123456789')", [post.id, post.revision_id, 'a'.repeat(32)])), e => e.code === '23514');
});
