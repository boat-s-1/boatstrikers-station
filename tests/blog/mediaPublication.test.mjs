import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {blankDocument} from '../../lib/blog/document.mjs';
const require=createRequire(new URL('../../scripts/blog/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
test('image delivery requires current published snapshot; scheduling, removal and unpublish hide media',async()=>{
 const db=new PGlite();
 try{
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;');
 for(const file of ['20261002141712_blog_media_platform.sql','20261003174612_blog_private_media_publication.sql'])await db.exec(readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 const q=async(s,a=[]) =>(await db.query(s,a)).rows;
 const author=(await q("select id from blog_authors limit 1"))[0].id,category=(await q("select id from blog_categories limit 1"))[0].id;
 const used=randomUUID(),unused=randomUUID();
 for(const id of [used,unused])await q('insert into blog_media(id,storage_path,alt) values($1,$2,$3)',[id,`drafts/2026-10-03/${id}.png`,'test']);
 const document={...blankDocument(),title:'test',category_id:category,author_ids:[author],cover:{media_id:used,alt:'test'},blocks:[{id:randomUUID(),type:'TEXT',data:{text:'test'}}]};
 const post=(await q('select blog_create_draft($1,$2::jsonb) as v',['media-test',document]))[0].v;
 await q('select blog_release($1,$2,now()+interval \'5 minutes\')',[post.id,post.version]);
 const visible=async()=>{await db.exec('set role anon');try{return await q('select id from blog_media');}finally{await db.exec('reset role');}};
 assert.deepEqual(await visible(),[]);
 await q("update blog_posts set scheduled_at=now()-interval '1 minute' where id=$1",[post.id]);await q('select blog_publish_due()');
 assert.deepEqual((await visible()).map(m=>m.id),[used]);
 const editor=(await q('select blog_editor_document($1) as v',[post.id]))[0].v;
 const saved=(await q('select blog_save_draft($1,$2,$3::jsonb) as v',[post.id,editor.version,{...document,cover:{media_id:null,alt:''}}]))[0].v;
 assert.deepEqual((await visible()).map(m=>m.id),[used]);
 await q('select blog_release($1,$2)',[post.id,saved.version]);assert.deepEqual(await visible(),[]);
 }finally{await db.close();}
});
