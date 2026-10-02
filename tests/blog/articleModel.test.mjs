import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { articleSections, fixtureEnabled, speechPresentation, themeCta, resolveRelated, articleMetadata, safeArticleLink } from '../../lib/blog/articleModel.mjs';
import { readPublicArticle } from '../../lib/blog/publicArticle.mjs';
import { BLOG_ARTICLE_FIXTURE } from '../../lib/blog/previewFixture.mjs';
import { validateDocument } from '../../lib/blog/document.mjs';
import { BLOG_CHARACTERS } from '../../lib/blog/characterAssets.mjs';
const uid=n=>`40000000-0000-4000-8000-${n.toString(16).padStart(12,'0')}`;
const post={id:uid(1),slug:'real-public',published_revision_id:uid(2),first_published_at:'2026-10-01T00:00:00Z',last_published_at:'2026-10-01T00:00:00Z'};
const revision={id:uid(2),post_id:uid(1),schema_version:1,title:'公開版だけ',excerpt:'実際の公開内容',category_id:uid(3),seo:{},cover:{media_id:uid(4)},noindex:false,
  blog_blocks:[{id:uid(8),position:1,type:'TEXT',data:{text:'公開本文'}},{id:uid(9),position:0,type:'HEADING',data:{level:2,text:'公開見出し'}}],
  blog_post_authors:[{author_id:uid(5),position:0}],blog_post_tags:[],blog_post_relations:[]};
function mockClient(response) {const calls=[];return {calls,from(table){const call={table,ops:[]};calls.push(call);const q=new Proxy({}, {get(_,key){if(key==='then') return (resolve,reject)=>Promise.resolve(response(table,call)).then(resolve,reject);return (...args)=>{call.ops.push([key,...args]);return q;};}});return q;}};}
function clientWith(rev=revision,found=post) {return mockClient(table=>({data:table==='blog_posts'?found:table==='blog_post_revisions'?rev:table==='blog_categories'?{id:uid(3),slug:'beginner',name:'初心者'}:table==='blog_authors'?[{id:uid(5),slug:'ichika',name:'一果'}]:table==='blog_media'?[{id:uid(4),public_path:'/uploaded/cover.png',alt:'公開画像',width:1000,height:600}]:[],error:null}));}
test('detail reads due published pointer and exact sealed revision; public media projection excludes storage secrets',async()=>{
  const c=clientWith();const a=await readPublicArticle(c,'real-public','2026-10-02T00:00:00Z');
  assert.equal(a.document.title,'公開版だけ');assert.equal(a.document.blocks[0].type,'HEADING');
  const p=c.calls.find(c=>c.table==='blog_posts');assert.ok(p.ops.some(x=>x[0]==='eq'&&x[1]==='state'&&x[2]==='published'));assert.ok(p.ops.some(x=>x[0]==='lte'&&x[1]==='first_published_at'));
  const r=c.calls.find(c=>c.table==='blog_post_revisions');assert.ok(r.ops.some(x=>x[0]==='eq'&&x[1]==='id'&&x[2]===uid(2)));assert.ok(r.ops.some(x=>x[0]==='eq'&&x[1]==='state'&&x[2]==='sealed'));assert.ok(r.ops.some(x=>x[0]==='eq'&&x[1]==='post_id'&&x[2]===uid(1)));
  assert.ok(!JSON.stringify(c.calls).match(/editing_revision|scheduled_revision|storage_path|blog_templates|select","\*/));
});
test('no post, missing snapshot, wrong snapshot and cross-post snapshot never fall back to draft/fixture',async()=>{
  assert.equal(await readPublicArticle(clientWith(revision,null),'real-public'),null);
  assert.equal(await readPublicArticle(clientWith(null),'real-public'),null);
  assert.equal(await readPublicArticle(clientWith({...revision,id:uid(99)}),'real-public'),null);
  assert.equal(await readPublicArticle(clientWith({...revision,post_id:uid(99)}),'real-public'),null);
  const c=clientWith();assert.equal(await readPublicArticle(c,'../preview/article'),null);assert.equal(c.calls.length,0);
});
test('detail query failure propagates and never returns partial content',async()=>{
  await assert.rejects(readPublicArticle(mockClient(()=>({data:null,error:new Error('RLS')})),'real-public'),/RLS/);
});
test('related articles use only matching due public snapshots and retain relation ordering metadata',async()=>{
  const relatedParent={...post,id:uid(11),slug:'related',published_revision_id:uid(12)};
  const c=mockClient((table,call)=>{
    const related=call.ops.some(o=>o[0]==='in');
    return {error:null,data:table==='blog_posts'?(related?[relatedParent]:post):table==='blog_post_revisions'?(related?[{id:uid(12),post_id:uid(11),title:'公開関連記事',excerpt:''}]:{...revision,blog_post_relations:[{position:0,related_post_id:uid(11)}]}):table==='blog_categories'?{id:uid(3),slug:'beginner'}:[]};
  });
  const a=await readPublicArticle(c,'real-public');assert.equal(a.relatedPosts[0].href,'/blog/articles/related');
  const query=c.calls.filter(c=>c.table==='blog_posts')[1];assert.ok(query.ops.some(x=>x[0]==='lte'&&x[1]==='first_published_at'));assert.ok(query.ops.some(x=>x[0]==='eq'&&x[2]==='published'));
});
test('production blocks fixture regardless of nodeEnv; local development and Vercel Preview only',()=>{
  assert.equal(fixtureEnabled({vercelEnv:'production',nodeEnv:'development'}),false);assert.equal(fixtureEnabled({nodeEnv:'production'}),false);
  assert.equal(fixtureEnabled({vercelEnv:'preview',nodeEnv:'production'}),true);assert.equal(fixtureEnabled({nodeEnv:'development'}),true);
});
test('fixture is valid schema v1, has all requested blocks, no publication dates and real assets',()=>{
  validateDocument(BLOG_ARTICLE_FIXTURE.document);
  const required=['TEXT','HEADING','IMAGE','DIALOGUE','DATA_CHECK','POINT','WARNING','QUOTE','CTA','RELATED_ARTICLES'];
  for(const type of required) assert.ok(BLOG_ARTICLE_FIXTURE.document.blocks.some(b=>b.type===type));
  for(const character of ['ichika','hatsune','kiina']) {assert.ok(BLOG_ARTICLE_FIXTURE.document.blocks.some(b=>b.type==='DIALOGUE'&&b.data.character===character));assert.equal(Object.keys(BLOG_CHARACTERS[character].poses).length,5);}
  assert.equal(BLOG_ARTICLE_FIXTURE.post.first_published_at,null);assert.equal(BLOG_ARTICLE_FIXTURE.post.last_published_at,null);
  for(const m of Object.values(BLOG_ARTICLE_FIXTURE.media)) assert.ok(fs.existsSync(fileURLToPath(new URL(`../../public${m.public_path}`,import.meta.url))));
});
test('fixture has no imports in public readers, search, or sitemap, and has crawler isolation',()=>{
  for(const path of ['lib/blog/publicIndex.mjs','lib/blog/publicArticle.mjs','lib/blog/publicServer.js','app/blog/page.js','app/sitemap.js']) {
    const code=fs.readFileSync(fileURLToPath(new URL(`../../${path}`,import.meta.url)),'utf8');assert.ok(!/previewFixture|BLOG_ARTICLE_FIXTURE/.test(code));
  }
  const route=fs.readFileSync(fileURLToPath(new URL('../../app/blog/preview/article/page.js',import.meta.url)),'utf8');assert.ok(route.indexOf('if(!fixtureEnabled')<route.indexOf("await import("));assert.ok(route.includes('index:false'));
  const config=fs.readFileSync(fileURLToPath(new URL('../../next.config.js',import.meta.url)),'utf8');assert.ok(config.includes('/blog/preview/:path*'));assert.ok(config.includes('X-Robots-Tag'));assert.ok(config.includes('noindex, nofollow, noarchive'));
});
test('sections derive stable H2/H3 anchors, preserve scenes and place authored end matter below body',()=>{
  const x=articleSections(BLOG_ARTICLE_FIXTURE.document.blocks);assert.equal(x.takeaways.length,1);assert.equal(x.related.length,1);assert.equal(x.ctas.length,1);assert.equal(x.toc.length,3);assert.equal(x.ending.length,4);
  assert.ok(x.toc.every(x=>x.id.startsWith('section-')));assert.ok(x.body.some(b=>b.type==='DIALOGUE_SCENE'));
});
test('consecutive speaker is compact, respects side changes and rejects guessed poses',()=>{
  const first={character:'ichika',pose:'pose1',alignment:'auto'};assert.equal(speechPresentation({...first,pose:'pose2'},first).compact,true);
  assert.equal(speechPresentation({...first,alignment:'right'},first).compact,false);assert.equal(speechPresentation({...first,character:'hatsune'},first).compact,false);
  assert.equal(speechPresentation({...first,pose:'made-up'}),null);
});
test('theme CTAs map expertise; related links do not invent inaccessible posts; public metadata uses publication times',()=>{
  assert.equal(themeCta('inside-course').href,'/ichika');assert.equal(themeCta('women').href,'/hatsune');assert.equal(themeCta('longshot').href,'/kiina');
  assert.equal(resolveRelated({post_ids:[uid(99)],paths:['/guide/course-entry','/blog/preview/article']},[]).length,1);
  assert.equal(safeArticleLink('javascript:alert(1)'),false);assert.equal(safeArticleLink('/blog/preview/article'),false);
  const a={...BLOG_ARTICLE_FIXTURE,post,document:{...BLOG_ARTICLE_FIXTURE.document,noindex:false}};const m=articleMetadata(a);assert.equal(m.alternates.canonical,'/blog/articles/real-public');assert.equal(m.openGraph.publishedTime,post.first_published_at);assert.equal(m.robots.index,true);
});
