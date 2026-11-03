import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { blankDocument } from '../../lib/blog/document.mjs';
import { REQUIRED_GATES } from '../../lib/blog/ai/gates.mjs';
const require = createRequire(new URL('../../scripts/blog/package.json', import.meta.url));
const { PGlite } = require('@electric-sql/pglite');

// PHASE 1: quality gate results and the automatic-approval mode, on top of the four existing BLOG migrations.
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
const save = (post, title) => rpc('blog_save_draft', [post.id, post.version, doc(title)], ['uuid', 'bigint', 'jsonb']);
const release = (post, at = null) => rpc('blog_release', [post.id, post.version, at], ['uuid', 'bigint', 'timestamptz']);
const approve = post => rpc('blog_ai_approve', [post.id, post.version, '編集 花子', 'a1b2c3d4e5f60718', new Date().toISOString()], ['uuid', 'bigint', 'text', 'text', 'timestamptz']);
const gates = (verdict = 'PASS', override = {}) => ({ ...Object.fromEntries(REQUIRED_GATES.map(k => [k, { verdict, issues: [] }])), ...override });
const record = (post, verdict = 'PASS', g = gates(verdict), attempt = 0) => rpc('blog_ai_record_gate_result',
  [post.id, post.version, attempt, verdict, JSON.stringify(g), 'blog-gates-v1', '[]'], ['uuid', 'bigint', 'integer', 'text', 'jsonb', 'text', 'jsonb']);
const systemApprove = (post, gateId) => rpc('blog_ai_system_approve', [post.id, post.version, gateId], ['uuid', 'bigint', 'uuid']);
const setMode = (mode, enabled) => role('service_role', () => q('update public.blog_ai_settings set approval_mode=$1, auto_publish_enabled=$2, updated_at=now()', [mode, enabled]));
async function markAi(post, { validatedVersion = post.version, blocking = 0 } = {}) {
  await role('service_role', () => q(`insert into public.blog_ai_drafts(post_id,model,prompt_version,source_pack,validated_version,blocking_issues)
    values($1,'test-model','test-v1','{"facts":[]}'::jsonb,$2,$3)
    on conflict (post_id) do update set validated_version=excluded.validated_version, blocking_issues=excluded.blocking_issues`, [post.id, validatedVersion, blocking]));
}
const rejectsWith = (fn, message) => assert.rejects(fn, e => String(e.message).includes(message));
async function aiPost(title) { const post = await create(title); await markAi(post); return post; }

before(async () => {
  db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;');
  await db.exec('alter default privileges in schema public grant all on tables to anon,authenticated,service_role; alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;');
  for (const name of MIGRATIONS) await db.exec(migration(name));
  author = (await q("select id from public.blog_authors where slug='kiina'"))[0].id;
  category = (await q("select id from public.blog_categories where slug='longshot'"))[0].id;
});
after(async () => await db?.close());

test('defaults: manual approval mode, automatic publication and generation off', async () => {
  assert.deepEqual(await q('select approval_mode, auto_publish_enabled, generation_enabled from public.blog_ai_settings'),
    [{ approval_mode: 'manual', auto_publish_enabled: false, generation_enabled: false }]);
  await rejectsWith(() => q("update public.blog_ai_settings set auto_publish_enabled=true"), 'blog_ai_settings_auto_requires_mode');
  await rejectsWith(() => q('delete from public.blog_ai_settings'), 'BLOG_AI_SETTINGS_REQUIRED');
  await rejectsWith(() => q('insert into public.blog_ai_settings(id) values (false)'), 'check');
});

test('while off, a PASS gate result cannot approve and the article cannot be released', async () => {
  const post = await aiPost('自動公開オフ');
  const g = await record(post);
  await rejectsWith(() => systemApprove(post, g.gate_result_id), 'BLOG_AI_AUTO_PUBLISH_DISABLED');
  await setMode('auto', false);
  await rejectsWith(() => systemApprove(post, g.gate_result_id), 'BLOG_AI_AUTO_PUBLISH_DISABLED');
  await rejectsWith(() => release(post), 'BLOG_AI_APPROVAL_REQUIRED');
  await setMode('manual', false);
});

test('in the automatic mode only a PASS in all seven gates, for the current version and content, approves', async () => {
  await setMode('auto', true);
  try {
    const retry = await aiPost('RETRY');
    await rejectsWith(async () => systemApprove(retry, (await record(retry, 'RETRY')).gate_result_id), 'BLOG_AI_GATE_NOT_PASSED');
    const hold = await aiPost('HOLD');
    await rejectsWith(async () => systemApprove(hold, (await record(hold, 'HOLD')).gate_result_id), 'BLOG_AI_GATE_NOT_PASSED');
    // A PASS verdict with a failing gate is rejected by the table itself.
    const forged = await aiPost('偽のPASS');
    await rejectsWith(() => record(forged, 'PASS', gates('PASS', { safety: { verdict: 'HOLD', issues: [] } })), 'blog_ai_gate_pass_requires_all');
    await rejectsWith(() => record(forged, 'PASS', { data_integrity: { verdict: 'PASS' } }), 'check');
    // Blocking validation issues or a version that was not validated still stop it.
    const blocking = await create('要修正あり'); await markAi(blocking, { blocking: 1 });
    await rejectsWith(async () => systemApprove(blocking, (await record(blocking)).gate_result_id), 'BLOG_AI_BLOCKING_ISSUES');
    // Another post's gate result cannot be used.
    const a = await aiPost('A'), b = await aiPost('B');
    await rejectsWith(async () => systemApprove(b, (await record(a)).gate_result_id), 'BLOG_AI_GATE_RESULT_NOT_FOUND');
    // A later gate result for the same version supersedes an earlier PASS.
    const later = await aiPost('後から再検査');
    const first = await record(later);
    await record(later, 'HOLD');
    await rejectsWith(() => systemApprove(later, first.gate_result_id), 'BLOG_AI_GATE_SUPERSEDED');
    // Saved after the gate: the result is stale (and the version check refuses the old version).
    let edited = await aiPost('検査後に修正');
    const g = await record(edited);
    edited = { ...edited, ...(await save(edited, '検査後に修正（直した）')) };
    await markAi(edited);
    await rejectsWith(() => systemApprove(edited, g.gate_result_id), 'BLOG_AI_GATE_STALE');
    // Content changed outside the normal save (same version): the md5 recorded by the database no longer matches.
    const tampered = await aiPost('保存を通らない変更');
    const tg = await record(tampered);
    await q("update public.blog_post_revisions set title='書き換え' where id=(select editing_revision_id from public.blog_posts where id=$1)", [tampered.id]);
    await rejectsWith(() => systemApprove(tampered, tg.gate_result_id), 'BLOG_AI_CONTENT_CHANGED');
  } finally { await setMode('manual', false); }
});

test('a system approval publishes, records which gate result allowed it, and the one-shot approval is consumed', async () => {
  await setMode('auto', true);
  try {
    const post = await aiPost('自動公開される記事');
    const g = await record(post);
    const approval = await systemApprove(post, g.gate_result_id);
    const stored = await q('select approver_kind, approver_name, gate_result_id from public.blog_ai_approvals where id=$1', [approval.approval_id]);
    assert.deepEqual(stored, [{ approver_kind: 'system', approver_name: 'system:quality-gate', gate_result_id: g.gate_result_id }]);
    assert.equal((await q('select status from public.blog_ai_drafts where post_id=$1', [post.id]))[0].status, 'approved');
    assert.equal((await release(post)).action, 'publish');
    const events = await q('select action, ai_approval_id from public.blog_publication_events where post_id=$1', [post.id]);
    assert.deepEqual(events, [{ action: 'publish', ai_approval_id: approval.approval_id }]);
  } finally { await setMode('manual', false); }
});

test('emergency stop: switching automatic publication off invalidates pending system approvals at release', async () => {
  await setMode('auto', true);
  const post = await aiPost('承認後に停止');
  await systemApprove(post, (await record(post)).gate_result_id);
  await setMode('auto', false);
  await rejectsWith(() => release(post), 'BLOG_AI_APPROVAL_REQUIRED');
  await setMode('manual', false);
  await rejectsWith(() => release(post), 'BLOG_AI_APPROVAL_REQUIRED');
  assert.equal((await q('select state from public.blog_posts where id=$1', [post.id]))[0].state, 'draft');
});

test('the manual approval mode keeps working exactly as before, with automatic publication off', async () => {
  const post = await aiPost('人が承認する記事');
  const approval = await approve(post);
  assert.equal((await q('select approver_kind, gate_result_id from public.blog_ai_approvals where id=$1', [approval.approval_id]))[0].approver_kind, 'human');
  assert.equal((await release(post)).action, 'publish');
  // Human-written posts (no AI draft record) are not affected at all.
  const human = await create('人が書いた記事');
  assert.equal((await release(human)).action, 'publish');
});

test('gate results and settings: append-only, bound to the stored content, private to service_role', async () => {
  const post = await aiPost('記録の保護');
  const g = await record(post);
  const row = (await q('select document_md5, edit_version, revision_id from public.blog_ai_gate_results where id=$1', [g.gate_result_id]))[0];
  assert.equal(row.document_md5, await rpc('blog_ai_document_md5', [post.id], ['uuid']));
  await rejectsWith(() => q("update public.blog_ai_gate_results set verdict='PASS' where id=$1", [g.gate_result_id]), 'BLOG_AI_GATE_RESULT_IMMUTABLE');
  await rejectsWith(() => q('delete from public.blog_ai_gate_results where id=$1', [g.gate_result_id]), 'BLOG_AI_GATE_RESULT_IMMUTABLE');
  await rejectsWith(() => rpc('blog_ai_record_gate_result', [post.id, post.version + 5, 0, 'PASS', JSON.stringify(gates()), 'v', '[]'], ['uuid', 'bigint', 'integer', 'text', 'jsonb', 'text', 'jsonb']), 'BLOG_EDIT_CONFLICT');
  await rejectsWith(() => record(post, 'PASS', gates(), 3), 'check');
  const human = await create('AIでない記事');
  await rejectsWith(() => record(human), 'BLOG_AI_NOT_AI_DRAFT');
  // A system approval without a gate result, or a human approval naming one, is impossible.
  await rejectsWith(() => q(`insert into public.blog_ai_approvals(post_id,revision_id,edit_version,document_md5,document,approver_name,approver_session,approver_kind)
    select $1, editing_revision_id, edit_version, md5('{}'::jsonb::text), '{}'::jsonb, 'x', 'a1b2c3d4e5f60718', 'system' from public.blog_posts where id=$1`, [post.id]), 'blog_ai_approvals_system_has_gate');
  for (const r of ['anon', 'authenticated']) {
    for (const t of ['blog_ai_settings', 'blog_ai_gate_results']) await assert.rejects(role(r, () => q(`select * from public.${t}`)), /permission denied/, `${r} ${t}`);
    for (const fn of ['blog_ai_system_approve(uuid,bigint,uuid)', 'blog_ai_record_gate_result(uuid,bigint,integer,text,jsonb,text,jsonb)', 'blog_ai_current_approval(uuid)']) {
      assert.equal((await q(`select has_function_privilege($1, 'public.${fn}', 'EXECUTE') as ok`, [r]))[0].ok, false, `${r} ${fn}`);
    }
  }
  assert.equal((await q("select count(*)::int as n from pg_class where relname in ('blog_ai_settings','blog_ai_gate_results') and relrowsecurity"))[0].n, 2);
});

test('the migration refuses to run twice and leaves blog_release untouched', async () => {
  await assert.rejects(db.exec(migration('20261103120000_blog_ai_quality_gates.sql')), /already applied/);
  await db.exec('rollback').catch(() => {});
  const fresh = new PGlite();
  try {
    await fresh.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    for (const name of MIGRATIONS.slice(0, 4)) await fresh.exec(migration(name));
    const before = (await fresh.query("select md5(prosrc) as h from pg_proc where proname='blog_release'")).rows[0].h;
    await fresh.exec(migration(MIGRATIONS[4]));
    const after = (await fresh.query("select md5(prosrc) as h from pg_proc where proname='blog_release'")).rows[0].h;
    assert.equal(after, before);
  } finally { await fresh.close(); }
});

test('rollback script: refuses while a system approval exists, otherwise restores the previous approval function', async () => {
  const rollback = readFileSync(new URL('../../ops/blog/ai-quality-gates-rollback.sql', import.meta.url), 'utf8');
  const fresh = new PGlite();
  const fq = async (sql, args = []) => (await fresh.query(sql, args)).rows;
  try {
    await fresh.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    for (const name of MIGRATIONS) await fresh.exec(migration(name));
    // With a system approval on record, nothing is changed.
    const a = (await fq("select id from public.blog_authors where slug='kiina'"))[0].id, c = (await fq("select id from public.blog_categories where slug='longshot'"))[0].id;
    const post = (await fq('select public.blog_create_draft($1, $2::jsonb) as r', [`rb-${randomUUID()}`, JSON.stringify({ ...blankDocument(), title: '戻し', category_id: c, author_ids: [a], blocks: [] })]))[0].r;
    await fq(`insert into public.blog_ai_drafts(post_id,model,prompt_version,source_pack,validated_version) values ($1,'m','v','{}'::jsonb,$2)`, [post.id, post.version]);
    await fq("update public.blog_ai_settings set approval_mode='auto', auto_publish_enabled=true");
    const g = (await fq(`select public.blog_ai_record_gate_result($1,$2,0,'PASS',$3::jsonb,'v','[]'::jsonb) as r`, [post.id, post.version, JSON.stringify(gates())]))[0].r;
    await fq('select public.blog_ai_system_approve($1,$2,$3)', [post.id, post.version, g.gate_result_id]);
    await assert.rejects(fresh.exec(rollback), /system approvals exist/);
    await fresh.exec('rollback').catch(() => {});
    assert.equal((await fq("select count(*)::int as n from public.blog_ai_gate_results"))[0].n, 1);
  } finally { await fresh.close(); }

  const clean = new PGlite();
  const cq = async (sql, args = []) => (await clean.query(sql, args)).rows;
  try {
    await clean.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    for (const name of MIGRATIONS.slice(0, 4)) await clean.exec(migration(name));
    const original = (await cq("select md5(prosrc) as h from pg_proc where proname='blog_ai_current_approval'"))[0].h;
    const releaseBefore = (await cq("select md5(prosrc) as h from pg_proc where proname='blog_release'"))[0].h;
    await clean.exec(migration(MIGRATIONS[4]));
    await clean.exec(rollback);
    assert.equal((await cq("select md5(prosrc) as h from pg_proc where proname='blog_ai_current_approval'"))[0].h, original);
    assert.equal((await cq("select md5(prosrc) as h from pg_proc where proname='blog_release'"))[0].h, releaseBefore);
    assert.deepEqual((await cq("select column_name from information_schema.columns where table_name='blog_ai_approvals' and column_name in ('approver_kind','gate_result_id')")), []);
    assert.equal((await cq("select to_regclass('public.blog_ai_gate_results') is null as gone, to_regclass('blog_ai_gates_archive.blog_ai_gate_results') is not null as kept"))[0].gone, true);
    assert.equal((await cq("select to_regclass('blog_ai_gates_archive.blog_ai_settings') is not null as kept"))[0].kept, true);
    assert.equal((await cq("select count(*)::int as n from pg_proc where proname in ('blog_ai_system_approve','blog_ai_record_gate_result')"))[0].n, 0);
  } finally { await clean.close(); }
});
