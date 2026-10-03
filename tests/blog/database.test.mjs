import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { blankDocument } from '../../lib/blog/document.mjs';
import { beginnerTemplate } from '../../lib/blog/beginnerTemplate.mjs';
const require = createRequire(new URL('../../scripts/blog/package.json', import.meta.url));
const { PGlite } = require('@electric-sql/pglite');
let db, author, category, existing;
const oldTables = ['bs_race_events','bs_race_entries','trinity_prediction_snapshots','hatsune_news','ichika_book_issues','seminar_magazine_issues'];
const q = async (sql,args=[]) => (await db.query(sql,args)).rows;
async function role(name, fn) { await db.exec(`set role ${name}`); try { return await fn(); } finally { await db.exec('reset role'); } }
async function rpc(name,args=[],types=[]) {
  return role('service_role',async()=> (await q(`select public.${name}(${args.map((_,i)=>`$${i+1}${types[i]?'::'+types[i]:''}`).join(',')}) as result`,args))[0].result);
}
const doc = title => ({...blankDocument(), title, category_id:category, author_ids:[author], blocks:[{id:randomUUID(),type:'TEXT',data:{text:title}}]});
const create = async title => rpc('blog_create_draft',[`test-${randomUUID()}`,doc(title)],['text','jsonb']);
const save = async (post,title) => rpc('blog_save_draft',[post.id,post.version,doc(title)],['uuid','bigint','jsonb']);
const release = async (post,at=null) => rpc('blog_release',[post.id,post.version,at],['uuid','bigint','timestamptz']);
const publicDoc = id => role('anon',async()=> (await q('select r.title from public.blog_posts p join public.blog_post_revisions r on r.id=p.published_revision_id where p.id=$1',[id]))[0]?.title ?? null);
const editor = id => rpc('blog_editor_document',[id],['uuid']);
async function schemaSnapshot() {
 return JSON.stringify(await q(`select c.relname,c.relrowsecurity,a.attname,format_type(a.atttypid,a.atttypmod) as type from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum>0 where n.nspname='public' and c.relname=any($1::text[]) order by c.relname,a.attnum`,[oldTables]));
}
before(async()=>{
 db = new PGlite();
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;');
 // Simulate Supabase defaults to prove the migration removes inherited public writes/RPC grants.
 await db.exec('alter default privileges in schema public grant all on tables to anon,authenticated,service_role; alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;');
 for (const table of oldTables) await db.exec(`create table public.${table}(id integer primary key, marker text); insert into public.${table} values(1,'unchanged');`);
 existing = await schemaSnapshot();
 await db.exec(readFileSync(new URL('../../supabase/migrations/20261002141712_blog_media_platform.sql',import.meta.url),'utf8'));
 author = (await q("select id from public.blog_authors where slug='ichika'"))[0].id;
 category = (await q("select id from public.blog_categories where slug='beginner'"))[0].id;
 console.log('Isolated validation engine:',(await q('select version()'))[0].version);
});
after(async()=>await db?.close());

test('migration adds 12 RLS-enabled BLOG tables and no public write grants',async()=>{
 const rows=await q("select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'blog_%'");
 assert.equal(rows.length,12); assert.ok(rows.every(x=>x.relrowsecurity));
 for(const roleName of ['anon','authenticated']) for(const row of rows){
   const access=(await q('select has_table_privilege($1,$2,\'INSERT\') or has_table_privilege($1,$2,\'UPDATE\') or has_table_privilege($1,$2,\'DELETE\') as writable',[roleName,`public.${row.relname}`]))[0];
   assert.equal(access.writable,false,row.relname);
 }
});
test('all BLOG functions are invoker-only and inaccessible to public clients',async()=>{
 const fns=await q("select p.oid,p.proname,p.prosecdef,has_function_privilege('anon',p.oid,'EXECUTE') as anon,has_function_privilege('authenticated',p.oid,'EXECUTE') as member,has_function_privilege('service_role',p.oid,'EXECUTE') as admin from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'blog_%'");
 assert.ok(fns.length>10); for(const fn of fns){assert.equal(fn.prosecdef,false);assert.equal(fn.anon,false);assert.equal(fn.member,false);assert.equal(fn.admin,true);}
 await assert.rejects(()=>role('anon',()=>q('select public.blog_publish_due()')),e=>e.code==='42501');
});
test('drafts and blocks are invisible to both anon and ordinary members',async()=>{
 const p=await create('secret draft');
 for(const name of ['anon','authenticated']) await role(name,async()=>{
   assert.equal((await q('select id from public.blog_posts where id=$1',[p.id])).length,0);
   assert.equal((await q('select id from public.blog_post_revisions where post_id=$1',[p.id])).length,0);
   assert.equal((await q('select id from public.blog_blocks where revision_id=$1',[p.revision_id])).length,0);
   await assert.rejects(()=>q('select editing_revision_id from public.blog_posts'),e=>e.code==='42501');
 });
});
test('publish selects one snapshot; autosave creates an isolated editing revision',async()=>{
 const p=await create('published original');const released=await release(p);
 assert.equal(await publicDoc(p.id),'published original');
 const next=await save(released,'private edit');
 assert.notEqual(next.revision_id,p.revision_id);
 assert.equal(await publicDoc(p.id),'published original');assert.equal((await editor(p.id)).document.title,'private edit');
 await role('anon',async()=>{assert.equal((await q('select title from public.blog_post_revisions where id=$1',[next.revision_id])).length,0);});
});
test('sealed revision and all linked content reject direct privileged edits',async()=>{
 const p=await create('fixed'); await release(p);
 for(const statement of ["update public.blog_post_revisions set title='corrupt' where id=$1",'delete from public.blog_post_revisions where id=$1',"update public.blog_blocks set data='{\"text\":\"corrupt\"}' where revision_id=$1",'delete from public.blog_post_authors where revision_id=$1'])
   await assert.rejects(()=>role('service_role',()=>q(statement,[p.revision_id])),e=>e.code==='55000');
 await assert.rejects(()=>role('service_role',()=>q("insert into public.blog_blocks(revision_id,id,position,type,data) values($1,$2,1,'TEXT','{\"text\":\"corrupt\"}')",[p.revision_id,randomUUID()])),e=>e.code==='55000');
 assert.equal(await publicDoc(p.id),'fixed');
});
test('reservation keeps old publication visible and later autosave does not change reservation',async()=>{
 let p=await create('old visible');p=await release(p);p=await save(p,'queued snapshot');
 const at=new Date(Date.now()+3600000).toISOString();const queued=await release(p,at);
 assert.equal(await publicDoc(p.id),'old visible');
 const edited=await save(queued,'work after queue');
 assert.notEqual(edited.revision_id,queued.revision_id);
 assert.equal((await q('select title from public.blog_post_revisions where id=$1',[queued.revision_id]))[0].title,'queued snapshot');
 await role('anon',async()=>assert.equal((await q('select id from public.blog_post_revisions where id=$1',[queued.revision_id])).length,0));
 assert.deepEqual(await rpc('blog_publish_due'),[]);
 // Test clock fixture only: move this test's due timestamp into the past, never production data.
 await q("update public.blog_posts set scheduled_at=now()-interval '1 second' where id=$1",[p.id]);
 const promoted=await rpc('blog_publish_due');assert.ok(promoted.some(x=>x.id===p.id));
 assert.equal(await publicDoc(p.id),'queued snapshot');assert.equal((await editor(p.id)).document.title,'work after queue');
 assert.deepEqual(await rpc('blog_publish_due'),[]);
});
test('first scheduled article stays hidden until the worker promotes it',async()=>{
 const p=await create('first schedule');await release(p,new Date(Date.now()+60000).toISOString());
 assert.equal(await publicDoc(p.id),null);
 await q("update public.blog_posts set scheduled_at=now()-interval '1 second' where id=$1",[p.id]);await rpc('blog_publish_due');
 assert.equal(await publicDoc(p.id),'first schedule');
});
test('cancel and unpublish hide queued/published versions without modifying snapshots',async()=>{
 let p=await create('cancel');p=await release(p,new Date(Date.now()+60000).toISOString());
 p=await rpc('blog_change_state',[p.id,p.version,'cancel_schedule'],['uuid','bigint','text']);
 assert.equal((await editor(p.id)).scheduled_at,null);assert.equal((await editor(p.id)).document.title,'cancel');assert.equal(await publicDoc(p.id),null);
 p=await save(p,'public');p=await release(p);
 await rpc('blog_change_state',[p.id,p.version,'unpublish'],['uuid','bigint','text']);
 assert.equal(await publicDoc(p.id),null);assert.equal((await q('select title from public.blog_post_revisions where id=$1',[p.revision_id]))[0].title,'public');
});
test('monotonic compare-and-swap blocks stale/null autosaves and stale publication',async()=>{
 const p=await create('v1');const v2=await save(p,'v2');
 await assert.rejects(()=>save(p,'stale'),e=>e.code==='40001');
 await assert.rejects(()=>release(p),e=>e.code==='40001');
 await assert.rejects(()=>rpc('blog_save_draft',[p.id,null,doc('null version')],['uuid','bigint','jsonb']),e=>e.code==='40001');
 assert.equal((await editor(p.id)).document.title,'v2');assert.equal(v2.version,p.version+1);
});
test('invalid save rolls back metadata and every block',async()=>{
 const p=await create('keep');const bad=doc('reject');bad.author_ids=[randomUUID()];
 await assert.rejects(()=>rpc('blog_save_draft',[p.id,p.version,bad],['uuid','bigint','jsonb']),e=>e.code==='23503');
 const e=await editor(p.id);assert.equal(e.version,p.version);assert.equal(e.document.title,'keep');assert.equal(e.document.blocks[0].data.text,'keep');
});
test('Dialogue Scene preserves all four turns, order, poses and alignment',async()=>{
 const d=doc('scene');d.blocks=beginnerTemplate(randomUUID).blocks.slice(0,1);
 d.blocks[0].data.turns[1].alignment='right';
 const p=await rpc('blog_create_draft',[`scene-${randomUUID()}`,d],['text','jsonb']);
 const saved=(await editor(p.id)).document.blocks[0].data.turns;
 assert.deepEqual(saved,d.blocks[0].data.turns);assert.deepEqual(saved.map(t=>t.character),['ichika','hatsune','kiina','ichika']);
});
test('SQL rejects guessed pose, duplicate turns, unknown blocks and unsafe links',async()=>{
 for(const mutate of [d=>d.blocks[0].data.turns[0].pose='invented',d=>d.blocks[0].data.turns[1].id=d.blocks[0].data.turns[0].id,d=>d.blocks[0].type='SCRIPT',d=>{d.blocks=[{id:randomUUID(),type:'CTA',data:{href:'javascript:alert(1)'}}];}]){
   const d=doc('bad');d.blocks=beginnerTemplate(randomUUID).blocks.slice(0,1);mutate(d);
   await assert.rejects(()=>rpc('blog_create_draft',[`invalid-${randomUUID()}`,d],['text','jsonb']),e=>e.code==='22023');
 }
});
test('public media hides private assets/storage paths; incomplete beginner template cannot publish',async()=>{
 const id=(await q("insert into public.blog_media(storage_path) values('draft-only.png') returning id"))[0].id;
 await role('anon',async()=>{assert.equal((await q('select id,public_path from public.blog_media where id=$1',[id])).length,0);await assert.rejects(()=>q('select storage_path from public.blog_media'),e=>e.code==='42501');});
 const d={...beginnerTemplate(randomUUID),author_ids:[author],category_id:category};
 const p=await rpc('blog_create_draft',[`template-${randomUUID()}`,d],['text','jsonb']);
 await assert.rejects(()=>release(p),e=>e.code==='22023');assert.equal((await editor(p.id)).version,p.version);
});
test('cross-post revision pointers and published slug changes are rejected',async()=>{
 const a=await create('a');const b=await create('b');
 await assert.rejects(()=>q('update public.blog_posts set editing_revision_id=$1 where id=$2',[b.revision_id,a.id]));
 await release(a);await assert.rejects(()=>q("update public.blog_posts set slug='changed' where id=$1",[a.id]));
});
test('publication history is private and existing table schemas/data are unchanged',async()=>{
 await assert.rejects(()=>role('anon',()=>q('select * from public.blog_publication_events')),e=>e.code==='42501');
 assert.equal(await schemaSnapshot(),existing);
 for(const table of oldTables) assert.deepEqual(await q(`select * from public.${table}`),[{id:1,marker:'unchanged'}]);
});

test('optional cleared cover publishes, private cover/body/OG images fail closed',async()=>{
 const privateId=(await q("insert into public.blog_media(storage_path) values('private-guard.png') returning id"))[0].id;
 const publicId=(await q("insert into public.blog_media(storage_path,status,public_path) values('public-guard.png','public','https://example.test/public.png') returning id"))[0].id;
 for(const place of ['cover','og','body']){
   const d=doc(place);
   if(place==='cover') d.cover={media_id:privateId};
   if(place==='og') d.seo={og_media_id:privateId};
   if(place==='body') d.blocks.push({id:randomUUID(),type:'IMAGE',data:{media_id:privateId,alt:'private'}});
   const p=await rpc('blog_create_draft',[`image-${randomUUID()}`,d],['text','jsonb']);
   await assert.rejects(()=>release(p),e=>e.code==='22023');assert.equal(await publicDoc(p.id),null);
 }
 const d=doc('cleared cover');d.cover={media_id:null};d.seo={og_media_id:publicId};
 const p=await rpc('blog_create_draft',[`image-${randomUUID()}`,d],['text','jsonb']);await release(p);assert.equal(await publicDoc(p.id),'cleared cover');
});
