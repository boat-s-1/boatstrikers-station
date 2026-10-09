import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(new URL('../../scripts/blog/package.json', import.meta.url));
const { PGlite } = require('@electric-sql/pglite');

// Proves the two AI migrations leave every pre-existing BLOG object's access rules untouched:
// table/column grants for anon/authenticated, RLS flags and policies, function ACLs and existing columns.
// Only the documented changes are allowed: blog_release body, one new column on blog_publication_events,
// and category rows (3 new, DATA LAB display name).
const BASE = ['20261002141712_blog_media_platform.sql', '20261003174612_blog_private_media_publication.sql'];
const AI = ['20261009180000_blog_ai_drafts.sql', '20261010090000_blog_ai_followups.sql'];
const migration = name => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
let db, beforeSnap, afterSnap, existingTables, existingFunctions, categoriesBefore, categoriesAfter;
const q = async (sql, args = []) => (await db.query(sql, args)).rows;

async function snapshot(tables, functions) {
  return {
    tableGrants: await q(`select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and table_name = any($1) and grantee in ('anon','authenticated','service_role') order by 1,2,3`, [tables]),
    columnGrants: await q(`select table_name, column_name, grantee, privilege_type from information_schema.role_column_grants where table_schema='public' and table_name = any($1) and grantee in ('anon','authenticated') order by 1,2,3,4`, [tables]),
    rls: await q(`select relname, relrowsecurity, relforcerowsecurity from pg_class where relnamespace='public'::regnamespace and relname = any($1) order by 1`, [tables]),
    policies: await q(`select tablename, policyname, cmd, roles::text, qual, with_check from pg_policies where schemaname='public' and tablename = any($1) order by 1,2`, [tables]),
    functionAcl: await q(`select p.oid::regprocedure::text as fn, coalesce(p.proacl::text,'') as acl, p.prosecdef from pg_proc p where p.pronamespace='public'::regnamespace and p.oid::regprocedure::text = any($1) order by 1`, [functions]),
    columns: await q(`select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name = any($1) order by 1, ordinal_position`, [tables]),
  };
}

before(async () => {
  db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;');
  await db.exec('alter default privileges in schema public grant all on tables to anon,authenticated,service_role; alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;');
  for (const name of BASE) await db.exec(migration(name));
  existingTables = (await q(`select relname from pg_class where relnamespace='public'::regnamespace and relkind='r' and relname like 'blog\\_%' order by 1`)).map(r => r.relname);
  existingFunctions = (await q(`select oid::regprocedure::text as fn from pg_proc where pronamespace='public'::regnamespace and proname like 'blog\\_%' order by 1`)).map(r => r.fn);
  beforeSnap = await snapshot(existingTables, existingFunctions);
  categoriesBefore = await q('select slug, name, position, active from public.blog_categories order by slug');
  for (const name of AI) await db.exec(migration(name));
  afterSnap = await snapshot(existingTables, existingFunctions);
  categoriesAfter = await q('select slug, name, position, active from public.blog_categories order by slug');
});
after(async () => await db?.close());

test('grants, column grants, RLS flags and policies of existing BLOG tables are unchanged', () => {
  assert.ok(existingTables.length >= 10);
  assert.deepEqual(afterSnap.tableGrants, beforeSnap.tableGrants);
  assert.deepEqual(afterSnap.columnGrants, beforeSnap.columnGrants);
  assert.deepEqual(afterSnap.rls, beforeSnap.rls);
  assert.deepEqual(afterSnap.policies, beforeSnap.policies);
});

test('existing BLOG functions keep their ACLs and SECURITY INVOKER', () => {
  assert.deepEqual(afterSnap.functionAcl, beforeSnap.functionAcl);
  assert.ok(afterSnap.functionAcl.every(f => f.prosecdef === false));
});

test('the only column change on existing tables is blog_publication_events.ai_approval_id (nullable)', () => {
  const key = c => `${c.table_name}.${c.column_name}`;
  const added = afterSnap.columns.filter(c => !beforeSnap.columns.some(b => key(b) === key(c)));
  assert.deepEqual(added.map(c => [key(c), c.is_nullable]), [['blog_publication_events.ai_approval_id', 'YES']]);
  assert.deepEqual(afterSnap.columns.filter(c => key(c) !== 'blog_publication_events.ai_approval_id'), beforeSnap.columns);
});

test('category changes are exactly: 3 additions and the DATA LAB display name', () => {
  const byslug = rows => Object.fromEntries(rows.map(r => [r.slug, r]));
  const b = byslug(categoriesBefore), a = byslug(categoriesAfter);
  assert.deepEqual(Object.keys(a).filter(k => !b[k]).sort(), ['characters', 'stadium-basics', 'stadium-charm']);
  for (const slug of Object.keys(b)) assert.deepEqual(a[slug], slug === 'data-lab' ? { ...b[slug], name: 'BoatStrikers DATA LAB' } : b[slug]);
});

test('new AI tables are invisible to anon and authenticated (no grants, RLS on, no policies)', async () => {
  const fresh = (await q(`select relname from pg_class where relnamespace='public'::regnamespace and relkind='r' and relname like 'blog\\_%'`)).map(r => r.relname).filter(t => !existingTables.includes(t)).sort();
  assert.deepEqual(fresh, ['blog_ai_approvals', 'blog_ai_drafts', 'blog_ai_manual_sources', 'blog_ai_runs', 'blog_post_derivatives', 'blog_source_documents', 'blog_source_urls', 'blog_topics']);
  const grants = await q(`select table_name, grantee from information_schema.role_table_grants where table_schema='public' and table_name = any($1) and grantee in ('anon','authenticated','PUBLIC')`, [fresh]);
  assert.deepEqual(grants, []);
  const rls = await q(`select relname from pg_class where relnamespace='public'::regnamespace and relname = any($1) and not relrowsecurity`, [fresh]);
  assert.deepEqual(rls, []);
  assert.deepEqual(await q(`select tablename from pg_policies where tablename = any($1)`, [fresh]), []);
  const fns = await q(`select p.oid::regprocedure::text as fn from pg_proc p where p.pronamespace='public'::regnamespace and p.proname like 'blog\\_ai\\_%' and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`);
  assert.deepEqual(fns, []);
});

test('the AI migration refuses to run on a database whose blog_release is missing or modified, changing nothing', async () => {
  for (const setup of [
    async d => { await d.exec(migration(BASE[0])); },                                   // 20261003174612 not applied
    async d => { for (const n of BASE) await d.exec(migration(n)); await d.exec("create or replace function public.blog_release(p_post_id uuid,p_expected_version bigint,p_publish_at timestamptz default null) returns jsonb language plpgsql as $$ begin return null; end; $$;"); },
  ]) {
    const d = new PGlite();
    await d.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;');
    await setup(d);
    await assert.rejects(() => d.exec(migration(AI[0])), e => /BLOG_AI_PRECHECK/.test(e.message));
    await d.exec('rollback').catch(() => {});
    assert.equal((await d.query("select to_regclass('public.blog_ai_drafts') is null as absent")).rows[0].absent, true);
    assert.equal((await d.query("select count(*)::int as n from public.blog_categories where slug='stadium-charm'")).rows[0].n, 0);
    await d.close();
  }
});

test('rollback script restores the pre-AI state exactly and refuses while unapproved AI drafts exist', async () => {
  const d = new PGlite();
  const dq = async (sql, args = []) => (await d.query(sql, args)).rows;
  await d.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;');
  await d.exec('alter default privileges in schema public grant all on tables to anon,authenticated,service_role; alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;');
  for (const n of BASE) await d.exec(migration(n));
  const prev = db; db = d;
  try {
    const base = await snapshot(existingTables, existingFunctions);
    const releaseBefore = (await dq("select md5(prosrc) m from pg_proc where oid='public.blog_release(uuid,bigint,timestamptz)'::regprocedure"))[0].m;
    const categories = await dq('select slug, name from public.blog_categories order by slug');
    for (const n of AI) await d.exec(migration(n));
    const rollback = readFileSync(new URL('../../ops/blog/ai-drafts-rollback.sql', import.meta.url), 'utf8');
    // An unpublished AI draft blocks the rollback.
    const cat = (await dq("select id from public.blog_categories where slug='beginner'"))[0].id, author = (await dq("select id from public.blog_authors where slug='ichika'"))[0].id;
    const doc = { schema_version: 1, title: 't', excerpt: '', category_id: cat, seo: {}, cover: {}, noindex: false, author_ids: [author], tag_ids: [], relations: [], blocks: [{ id: '00000000-0000-4000-8000-000000000001', type: 'TEXT', data: { text: 't' } }] };
    const post = (await dq("select public.blog_create_draft('rollback-test', $1::jsonb) as r", [doc]))[0].r;
    await dq(`insert into public.blog_ai_drafts(post_id,model,prompt_version,source_pack) values($1,'m','v','{}'::jsonb)`, [post.id]);
    await assert.rejects(() => d.exec(rollback), e => /BLOG_AI_ROLLBACK/.test(e.message));
    await d.exec('rollback').catch(() => {});
    await dq('delete from public.blog_ai_drafts'); await dq('delete from public.blog_post_authors'); await dq('delete from public.blog_blocks');
    await dq('update public.blog_posts set editing_revision_id=null'); await dq('delete from public.blog_post_revisions'); await dq('delete from public.blog_posts');
    await d.exec(rollback);
    assert.deepEqual(await snapshot(existingTables, existingFunctions), base);
    assert.equal((await dq("select md5(prosrc) m from pg_proc where oid='public.blog_release(uuid,bigint,timestamptz)'::regprocedure"))[0].m, releaseBefore);
    assert.deepEqual(await dq('select slug, name from public.blog_categories order by slug'), categories);
    assert.equal((await dq("select to_regclass('public.blog_ai_drafts') is null as gone"))[0].gone, true);
  } finally { db = prev; await d.close(); }
});

test('ops pre-check passes before the migrations and post-check passes after them (read-only SQL)', async () => {
  const d = new PGlite();
  await d.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;');
  await d.exec('alter default privileges in schema public grant all on tables to anon,authenticated,service_role; alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;');
  for (const n of BASE) await d.exec(migration(n));
  const sql = name => readFileSync(new URL(`../../ops/blog/${name}`, import.meta.url), 'utf8');
  for (const name of ['ai-drafts-precheck.sql', 'ai-drafts-postcheck.sql']) assert.doesNotMatch(sql(name).replace(/--[^\n]*/g, '').toLowerCase(), /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate)\b/);
  const pre = (await d.query(sql('ai-drafts-precheck.sql'))).rows;
  assert.ok(pre.length >= 10 && pre.every(r => r.ok === true), JSON.stringify(pre));
  const postBefore = (await d.query(sql('ai-drafts-postcheck.sql'))).rows;
  assert.ok(postBefore.some(r => r.ok === false), 'post-check must fail before applying');
  for (const n of AI) await d.exec(migration(n));
  const post = (await d.query(sql('ai-drafts-postcheck.sql'))).rows;
  assert.ok(post.every(r => r.ok === true), JSON.stringify(post));
  const preAfter = (await d.query(sql('ai-drafts-precheck.sql'))).rows;
  assert.equal(preAfter.find(r => r.check === 'ai_tables_not_yet_created').ok, false, 'pre-check detects an already-applied migration');
  await d.close();
});

test('article snapshot is read-only and identical before and after the migrations', async () => {
  const d = new PGlite();
  await d.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;');
  for (const n of BASE) await d.exec(migration(n));
  const sql = readFileSync(new URL('../../ops/blog/ai-drafts-article-snapshot.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(sql.replace(/--[^\n]*/g, '').toLowerCase(), /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate)\b/);
  const cat = slug => d.query("select id from public.blog_categories where slug=$1", [slug]).then(r => r.rows[0].id);
  const author = (await d.query("select id from public.blog_authors where slug='ichika'")).rows[0].id;
  const doc = (title, category) => ({ schema_version: 1, title, excerpt: '', category_id: category, seo: {}, cover: {}, noindex: false, author_ids: [author], tag_ids: [], relations: [], blocks: [{ id: crypto.randomUUID(), type: 'TEXT', data: { text: title } }] });
  // Five articles in different states, like staging: published, edited-after-publish, scheduled, draft, unpublished.
  const make = async (slug, category) => (await d.query("select public.blog_create_draft($1, $2::jsonb) as r", [slug, doc(slug, await cat(category))])).rows[0].r;
  const rel = (p, at = null) => d.query("select public.blog_release($1,$2,$3) as r", [p.id, p.version, at]).then(r => r.rows[0].r);
  const a = await make('a-published', 'data-lab'); await rel(a);
  const b = await make('b-edited', 'beginner'); const b1 = await rel(b);
  await d.query("select public.blog_save_draft($1,$2,$3::jsonb)", [b.id, b1.version, doc('b edited', await cat('beginner'))]);
  const c = await make('c-scheduled', 'stadiums'); await rel(c, new Date(Date.now() + 86400000).toISOString());
  await make('d-draft', 'women');
  const e = await make('e-unpublished', 'news'); const e1 = await rel(e);
  await d.query("select public.blog_change_state($1,$2,'unpublish')", [e.id, e1.version]);
  const before = (await d.query(sql)).rows;
  assert.equal(before.length, 5);
  for (const n of AI) await d.exec(migration(n));
  assert.deepEqual((await d.query(sql)).rows, before);
  // Publishing still works for an existing human-written article after the migrations.
  const ed = (await d.query("select public.blog_editor_document($1) as r", [b.id])).rows[0].r;
  assert.equal((await rel({ id: b.id, version: ed.version })).action, 'publish');
  await d.close();
});
