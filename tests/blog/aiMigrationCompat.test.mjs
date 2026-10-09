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
  // String literals are data (e.g. privilege names passed to has_table_privilege), so strip them before scanning for statements.
  for (const name of ['ai-drafts-precheck.sql', 'ai-drafts-postcheck.sql']) assert.doesNotMatch(sql(name).replace(/--[^\n]*/g, '').replace(/'[^']*'/g, "''").toLowerCase(), /\b(insert|update|delete|merge|drop|alter|create|grant|revoke|truncate|copy|call|do|lock|set)\b/);
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

test('rollback also works when only the first AI migration was applied', async () => {
  const d = new PGlite();
  await d.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;');
  await d.exec('alter default privileges in schema public grant all on tables to anon,authenticated,service_role; alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;');
  for (const n of BASE) await d.exec(migration(n));
  const prev = db; db = d;
  try {
    const base = await snapshot(existingTables, existingFunctions);
    await d.exec(migration(AI[0]));
    await d.exec(readFileSync(new URL('../../ops/blog/ai-drafts-rollback.sql', import.meta.url), 'utf8'));
    assert.deepEqual(await snapshot(existingTables, existingFunctions), base);
    assert.equal((await d.query("select to_regclass('public.blog_topics') is null as gone")).rows[0].gone, true);
  } finally { db = prev; await d.close(); }
});

test('strict post-check: 77 individual rows, all true; each kind of misconfiguration turns its own row false', async () => {
  const sql = readFileSync(new URL('../../ops/blog/ai-drafts-postcheck.sql', import.meta.url), 'utf8');
  const fresh = async () => {
    const d = new PGlite();
    await d.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;');
    await d.exec('alter default privileges in schema public grant all on tables to anon,authenticated,service_role; alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;');
    for (const n of [...BASE, ...AI]) await d.exec(migration(n));
    return d;
  };
  const failing = async d => (await d.query(sql)).rows.filter(r => r.ok !== true).map(r => r.check);
  let d = await fresh();
  const rows = (await d.query(sql)).rows;
  assert.equal(rows.length, 77);
  assert.deepEqual(rows.filter(r => r.ok !== true), []);
  for (const [breakIt, expected] of [
    ['alter table public.blog_ai_runs disable row level security', ['table_rls_enabled:blog_ai_runs']],
    ['create policy leak on public.blog_topics for select to anon using (true)', ['table_has_no_policies:blog_topics']],
    ['grant select on public.blog_ai_drafts to anon', ['table_closed_to_anon_and_authenticated:blog_ai_drafts']],
    ['grant select (id) on public.blog_source_urls to authenticated', ['table_closed_to_anon_and_authenticated:blog_source_urls']],
    ['grant insert on public.blog_ai_manual_sources to public', ['table_closed_to_anon_and_authenticated:blog_ai_manual_sources']],
    ['revoke delete on public.blog_post_derivatives from service_role', ['table_service_role_read_write:blog_post_derivatives']],
    ['grant execute on function public.blog_ai_approve(uuid,bigint,text,text,timestamptz) to public', ['function_closed_to_anon_and_authenticated:public.blog_ai_approve(uuid,bigint,text,text,timestamptz)']],
    ['alter function public.blog_ai_document_md5(uuid) security definer', ['function_security_invoker:public.blog_ai_document_md5(uuid)']],
    ['revoke execute on function public.blog_ai_current_approval(uuid) from service_role', ['function_service_role_execute:public.blog_ai_current_approval(uuid)']],
    ['alter table public.blog_ai_approvals disable trigger blog_ai_approvals_append_only', ['approvals_append_only_trigger_enabled']],
    [`create or replace function public.blog_release(p_post_id uuid,p_expected_version bigint,p_publish_at timestamptz default null) returns jsonb language plpgsql security invoker set search_path = '' as $$ begin return null; end; $$`, ['function_body_matches_repository:public.blog_release(uuid,bigint,timestamptz)']],
  ]) {
    await d.close(); d = await fresh();
    await d.exec(breakIt);
    assert.deepEqual(await failing(d), expected, breakIt);
  }
  await d.close();
});

test('rollback keeps every history row in the private archive, detached from live tables, and refuses to overwrite an archive', async () => {
  const d = new PGlite();
  const dq = async (sql, args = []) => (await d.query(sql, args)).rows;
  await d.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;');
  await d.exec('alter default privileges in schema public grant all on tables to anon,authenticated,service_role; alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;');
  for (const n of [...BASE, ...AI]) await d.exec(migration(n));
  const rollback = readFileSync(new URL('../../ops/blog/ai-drafts-rollback.sql', import.meta.url), 'utf8');
  // A published AI article with full history in every AI table.
  const cat = (await dq("select id from public.blog_categories where slug='stadium-basics'"))[0].id, author = (await dq("select id from public.blog_authors where slug='ichika'"))[0].id;
  const doc = { schema_version: 1, title: 'AI 記事', excerpt: '', category_id: cat, seo: {}, cover: {}, noindex: false, author_ids: [author], tag_ids: [], relations: [], blocks: [{ id: '00000000-0000-4000-8000-0000000000aa', type: 'TEXT', data: { text: 'AI' } }] };
  const post = (await dq("select public.blog_create_draft('ai-history', $1::jsonb) as r", [doc]))[0].r;
  const topic = (await dq("insert into public.blog_topics(topic_key,category_slug,stadium_slug,angle,title_hint,status,post_id) values('stadium-basics:kiryu:water','stadium-basics','kiryu','water','桐生','drafted',$1) returning id", [post.id]))[0].id;
  const url = (await dq("insert into public.blog_source_urls(stadium_slug,url,label,kind) values('kiryu','https://www.boatrace.jp/owpc/pc/data/stadium?jcd=01','公式','official_data') returning id"))[0].id;
  await dq("insert into public.blog_source_documents(source_url_id,stadium_slug,url,kind,fetched_at,extracted_text) values($1,'kiryu','https://www.boatrace.jp/owpc/pc/data/stadium?jcd=01','official_data',now(),'本文')", [url]);
  await dq("insert into public.blog_ai_drafts(post_id,topic_id,model,prompt_version,source_pack,validated_version) values($1,$2,'m','v','{}'::jsonb,$3)", [post.id, topic, post.version]);
  const approval = (await dq("select public.blog_ai_approve($1,$2,'山田','abcdef0123456789',now()) as r", [post.id, post.version]))[0].r;
  await dq("select public.blog_release($1,$2,null)", [post.id, post.version]);
  await dq("insert into public.blog_ai_manual_sources(post_id,statement,source_label,source_url,checked_at,registered_by) values($1,'事実','公式','https://a.example/',now(),'山田')", [post.id]);
  await dq("insert into public.blog_post_derivatives(post_id,revision_id,channel,body) values($1,$2,'x','本文')", [post.id, post.revision_id]);
  await dq("insert into public.blog_ai_runs(trigger,status,topic_id,post_id) values('schedule','succeeded',$1,$2)", [topic, post.id]);
  const tables = ['blog_source_urls','blog_source_documents','blog_topics','blog_ai_drafts','blog_ai_approvals','blog_post_derivatives','blog_ai_manual_sources','blog_ai_runs'];
  const before = {}; for (const t of tables) before[t] = (await dq(`select count(*)::int n from public.${t}`))[0].n;
  assert.ok(Object.values(before).every(n => n === 1));

  await d.exec(rollback);
  // History preserved, row for row, in the private archive.
  for (const t of tables) assert.equal((await dq(`select count(*)::int n from blog_ai_archive.${t}`))[0].n, before[t], t);
  assert.deepEqual(await dq('select publication_event_id is not null as e, ai_approval_id from blog_ai_archive.publication_event_approvals'), [{ e: true, ai_approval_id: approval.approval_id }]);
  assert.equal((await dq('select approver_name from blog_ai_archive.blog_ai_approvals'))[0].approver_name, '山田');
  // Live schema is back to the pre-AI shape; the published article and its events are untouched.
  for (const t of tables) assert.equal((await dq(`select to_regclass('public.${t}') is null as gone`))[0].gone, true, t);
  assert.equal((await dq("select state from public.blog_posts where id=$1", [post.id]))[0].state, 'published');
  assert.equal((await dq("select count(*)::int n from public.blog_publication_events where post_id=$1", [post.id]))[0].n, 1);
  // stadium-basics is still used by the article, so it is kept; the unused ones are removed; DATA LAB name restored.
  assert.deepEqual((await dq("select slug from public.blog_categories where slug in ('stadium-charm','stadium-basics','characters') order by slug")).map(r => r.slug), ['stadium-basics']);
  assert.equal((await dq("select name from public.blog_categories where slug='data-lab'"))[0].name, 'DATA LAB');
  // Archive is private and read-only; approvals stay append-only.
  for (const r of ['anon', 'authenticated']) assert.equal((await dq(`select has_schema_privilege('${r}','blog_ai_archive','USAGE') as u`))[0].u, false);
  assert.equal((await dq("select has_table_privilege('service_role','blog_ai_archive.blog_ai_approvals','SELECT') s, has_table_privilege('service_role','blog_ai_archive.blog_ai_approvals','DELETE') x"))[0].x, false);
  await assert.rejects(() => dq("delete from blog_ai_archive.blog_ai_approvals"), e => /BLOG_AI_APPROVAL_IMMUTABLE/.test(e.message));
  // Archived history no longer blocks changes to live rows (no foreign keys into public).
  assert.deepEqual(await dq("select conname from pg_constraint c join pg_class r on r.oid=c.confrelid where c.contype='f' and c.connamespace='blog_ai_archive'::regnamespace and r.relnamespace='public'::regnamespace"), []);
  // Re-applying the feature later works, and a second rollback refuses to overwrite the first archive.
  for (const n of AI) await d.exec(migration(n));
  await assert.rejects(() => d.exec(rollback), e => /blog_ai_archive already exists/.test(e.message));
  await d.exec('rollback').catch(() => {});
  assert.equal((await dq("select to_regclass('public.blog_ai_drafts') is not null as present"))[0].present, true);
  await d.close();
});
