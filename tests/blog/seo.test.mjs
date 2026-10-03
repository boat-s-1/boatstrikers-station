import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { blankDocument,validateDocument } from '../../lib/blog/document.mjs';
import { BLOG_ARTICLE_FIXTURE } from '../../lib/blog/previewFixture.mjs';
import { readPublicIndex } from '../../lib/blog/publicIndex.mjs';
import { readPublicArticle } from '../../lib/blog/publicArticle.mjs';
import { articleMetadata,articleStructuredData,articleOgImage,jsonLdText,blogIndexMetadata,blogRobots,
  blogSitemapEntries,tagIndexable,authorIdentity,DEFAULT_OG_IMAGE,BLOG_ORIGIN } from '../../lib/blog/seo.mjs';
const require=createRequire(import.meta.url);
const {slugRedirects}=require('../../lib/blog/slugRedirects.cjs');
const now=Date.parse('2026-10-03T12:00:00Z');
const uid=n=>`80000000-0000-4000-8000-${n.toString(16).padStart(12,'0')}`;
const post={id:uid(1),state:'published',slug:'seo-test',published_revision_id:uid(2),first_published_at:'2026-10-01T15:00:00+09:00',last_published_at:'2026-10-02T15:00:00+09:00'};
const revision={id:uid(2),post_id:uid(1),noindex:false,category_id:uid(3),blog_post_authors:[{author_id:uid(4)}],blog_post_tags:[{tag_id:uid(5)}]};
const category={id:uid(3),slug:'beginner',name:'初心者'};
const author={id:uid(4),slug:'ichika',character_key:'ichika',name:'一果',role:'イン逃げ・データ研究'};
const tag={id:uid(5),slug:'entry',name:'進入'};
const doc={...blankDocument(),title:'SEO検証用',excerpt:'テスト専用の概要',seo:{title:'専用タイトル',description:'専用説明',og_media_id:uid(6)}};
const article={post,document:doc,authors:[author],category,tags:[tag],media:{[uid(6)]:{public_path:'/uploads/test.png',alt:'テスト画像',width:1200,height:630}},relatedPosts:[]};
const index={posts:[{...post,revision}],categories:[category],authors:[author],tags:[tag]};
const read=path=>fs.readFileSync(new URL(`../../${path}`,import.meta.url),'utf8');

test('article metadata reflects SEO, canonical, OGP, timestamps, author, category and tags',()=>{
  const m=articleMetadata(article,{env:'production',now});
  assert.equal(m.title.absolute,'専用タイトル｜BOATSTRIKERS BLOG');assert.equal(m.description,'専用説明');
  assert.equal(new URL(m.alternates.canonical,BLOG_ORIGIN).href,`${BLOG_ORIGIN}/blog/articles/seo-test`);
  assert.equal(m.openGraph.url,`${BLOG_ORIGIN}/blog/articles/seo-test`);assert.equal(m.openGraph.images[0].url,`${BLOG_ORIGIN}/uploads/test.png`);
  assert.equal(Date.parse(m.openGraph.publishedTime),Date.parse(post.first_published_at));assert.equal(Date.parse(m.openGraph.modifiedTime),Date.parse(post.last_published_at));
  assert.deepEqual(m.keywords,['進入']);assert.equal(m.category,'初心者');assert.equal(m.authors[0].name,'一果');assert.equal(m.robots.index,true);
  assert.equal(m.twitter.card,'summary_large_image');assert.ok(m.authors[0].url.endsWith('/blog/authors/ichika'));
});
test('noindex, scheduled, draft, missing pointer, invalid dates and Preview are fail-closed',()=>{
  for(const p of [{...post,state:'draft'},{...post,state:'unpublished'},{...post,published_revision_id:null},{...post,first_published_at:'2027-01-01T00:00:00Z'},{...post,first_published_at:null}]) {
    assert.equal(articleMetadata({...article,post:p},{env:'production',now}).robots.index,false);
    assert.deepEqual(articleStructuredData({...article,post:p},{env:'production',now}),[]);
  }
  assert.equal(articleMetadata({...article,document:{...doc,noindex:true}},{now}).robots.index,false);
  assert.equal(articleMetadata(article,{env:'preview',now}).robots.index,false);
  assert.deepEqual(articleStructuredData(article,{preview:true,now}),[]);
  assert.deepEqual(articleStructuredData(BLOG_ARTICLE_FIXTURE,{env:'production',now}),[]);
});
test('BlogPosting and BreadcrumbList use actual title/dates and editorial organizations, never experts or NewsArticle',()=>{
  const [posting,crumbs]=articleStructuredData(article,{env:'production',now});
  assert.equal(posting['@type'],'BlogPosting');assert.equal(posting.headline,doc.title);assert.equal(posting.datePublished,'2026-10-01T06:00:00.000Z');
  assert.equal(posting.author[0]['@type'],'Organization');assert.match(posting.author[0].description,/編集キャラクター/);
  assert.ok(!JSON.stringify(posting).match(/NewsArticle|Person|award|alumniOf|hasCredential/));
  assert.equal(crumbs['@type'],'BreadcrumbList');assert.deepEqual(crumbs.itemListElement.map(x=>x.position),[1,2,3]);
  assert.equal(crumbs.itemListElement[1].item,`${BLOG_ORIGIN}/blog/categories/beginner`);
  assert.equal(crumbs.itemListElement[2].item,posting.url);
  for(const slug of ['ichika','hatsune','kiina'])assert.match(authorIdentity({slug,name:slug}),/編集キャラクター/);
});
test('JSON-LD cannot terminate script element or inject markup',()=>{
  const value={'text':'</script><script>alert(1)</script>\u2028\u2029'};
  const output=jsonLdText(value);assert.ok(!output.includes('<'));assert.ok(!output.includes('\u2028'));assert.deepEqual(JSON.parse(output),value);
});
test('OGP chooses dedicated image then cover then stable BLOG fallback, excluding private/fixture/unsafe links',()=>{
  assert.equal(articleOgImage(article).url,`${BLOG_ORIGIN}/uploads/test.png`);
  const a={...article,document:{...doc,cover:{media_id:uid(7)}},media:{[uid(7)]:{public_path:'https://cdn.example.test/cover.webp'}}};
  assert.equal(articleOgImage(a).url,'https://cdn.example.test/cover.webp');
  for(const path of ['/blog-preview/reading-cover.svg','/blog/preview/private.png','javascript:alert(1)','//evil.test/a.png','https://cdn.test/a.png?token=private','https://user:pass@cdn.test/a.png','/uploads/test.svg']) {
    assert.equal(articleOgImage({...article,media:{[uid(6)]:{public_path:path}}}).url,DEFAULT_OG_IMAGE);
  }
  const invalid=blankDocument();invalid.seo.og_media_id='guessed';assert.throws(()=>validateDocument(invalid));
});
test('sitemap includes only due, matching, indexable public snapshots; reservation never replaces public version',()=>{
  const bad=[{...post,id:uid(11),slug:'draft',state:'draft',revision}, {...post,id:uid(12),slug:'future',first_published_at:'2027-01-01T00:00:00Z',revision},
    {...post,slug:'hidden',revision:{...revision,noindex:true}}, {...post,slug:'editing',revision:{...revision,id:uid(20)}}, {...post,slug:'cross-post',revision:{...revision,post_id:uid(21)}}];
  const result=blogSitemapEntries({...index,posts:[...index.posts,...bad]},{env:'production',now});
  const urls=result.map(x=>x.url);assert.ok(urls.includes(`${BLOG_ORIGIN}/blog/articles/seo-test`));assert.equal(urls.filter(x=>x.includes('/articles/')).length,1);
  assert.ok(urls.includes(`${BLOG_ORIGIN}/blog/categories/beginner`));assert.ok(urls.includes(`${BLOG_ORIGIN}/blog/authors/ichika`));
  assert.ok(!urls.some(x=>x.includes('/tags/')));assert.ok(result.every(x=>!x.url.includes('?')));
  assert.deepEqual(blogSitemapEntries(index,{env:'preview',now}),[]);
  const publicWithReservation={...index.posts[0],scheduled_revision_id:uid(40),scheduled_at:'2027-01-01T00:00:00Z'};
  assert.ok(blogSitemapEntries({...index,posts:[publicWithReservation]},{now}).some(x=>x.url.endsWith('/articles/seo-test')));
});
test('tags require deliberate opt-in, substantive unique text and five indexable posts',()=>{
  const description='進入とコースの違いを学び、展示で確認した情報と本番の展開を分けて読むためのテーマ別記事集です。艇番だけでは分からない並び、選手の傾向、イン逃げと穴条件の視点を整理します。';
  const policy={entry:{index:true,description}};
  const posts=Array.from({length:5},(_,i)=>({...post,id:uid(100+i),slug:`entry-${i}`,published_revision_id:uid(200+i),revision:{...revision,id:uid(200+i),post_id:uid(100+i)}}));
  assert.equal(tagIndexable(tag,posts,policy,now),true);assert.equal(tagIndexable(tag,posts.slice(1),policy,now),false);
  assert.equal(tagIndexable(tag,posts,{},now),false);assert.equal(tagIndexable(tag,posts,{entry:{index:true,description:'短い'}},now),false);
  assert.equal(tagIndexable(tag,posts.map(p=>({...p,revision:{...p.revision,noindex:true}})),policy,now),false);
  assert.ok(blogSitemapEntries({...index,posts},{now,tagPolicy:policy}).some(x=>x.url.endsWith('/tags/entry')));
});
test('search, pagination and preview robots block indexation while production keeps existing routes',()=>{
  assert.equal(blogIndexMetadata({},'production').robots.index,true);
  for(const params of [{q:'展示'},{q:''},{category:'women'},{tag:'entry'},{page:'2'}])assert.equal(blogIndexMetadata(params,'production').robots.index,false);
  assert.equal(blogIndexMetadata({},'preview').robots.index,false);assert.deepEqual(blogRobots('preview'),{rules:{userAgent:'*',disallow:'/'}});
  assert.equal(blogRobots('production'),null);
  const robots=read('app/robots.js');assert.ok(robots.includes('blogRobots(process.env.VERCEL_ENV)'));assert.ok(robots.includes('"/api/"'));assert.ok(robots.includes('"/members/"'));
  assert.ok(read('app/sitemap.js').includes('blogSitemapEntries(await loadPublicBlogIndex()'));assert.ok(read('app/sitemap.js').includes('...stadiumEntries'));
});
test('published slug remains immutable; exceptional redirects are permanent, internal, chain-free',()=>{
  assert.ok(read('supabase/migrations/20261002141712_blog_media_platform.sql').includes('BLOG_PUBLISHED_SLUG_IMMUTABLE'));
  assert.deepEqual(slugRedirects({'old-slug':'new-slug'}),[{source:'/blog/articles/old-slug',destination:'/blog/articles/new-slug',permanent:true}]);
  for(const map of [{'old':'https://evil.test'},{'old':'old'},{a:'b',b:'c'},{a:'b',b:'a'}])assert.throws(()=>slugRedirects(map));
  assert.deepEqual(slugRedirects(),[]);assert.ok(read('next.config.js').includes('...slugRedirects()'));
});
function client(response){const calls=[];return {calls,from(table){const ops=[];calls.push({table,ops});const q=new Proxy({},{get(_,k){if(k==='then')return(resolve,reject)=>Promise.resolve(response(table,ops)).then(resolve,reject);return(...args)=>{ops.push([k,...args]);return q;};}});return q;}};}
test('sitemap reader loads noindex from public snapshot, never draft blocks or service role',async()=>{
  const c=client(table=>({error:null,data:table==='blog_posts'?[post]:table==='blog_post_revisions'?[revision]:[]}));
  const result=await readPublicIndex(c);assert.equal(result.posts[0].revision.noindex,false);
  assert.ok(c.calls.find(x=>x.table==='blog_post_revisions').ops[0][1].includes('noindex'));
  assert.ok(!JSON.stringify(c.calls).match(/scheduled_revision|editing_revision|blog_blocks/));
});
test('public detail fetches OGP media ID from selected snapshot only',async()=>{
  const c=client(table=>({error:null,data:table==='blog_posts'?post:table==='blog_post_revisions'?{...revision,...doc,blog_blocks:[],blog_post_relations:[]}:table==='blog_categories'?category:[]}));
  await readPublicArticle(c,post.slug);
  assert.ok(c.calls.find(x=>x.table==='blog_media').ops.some(o=>o[0]==='in'&&o[1]==='id'&&o[2].includes(uid(6))));
});
test('readers reject not-yet-public rows even when a faulty response ignores database filters',async()=>{
  for(const parent of [{...post,state:'draft'},{...post,first_published_at:'2027-01-01T00:00:00Z'}]) {
    const list=client(table=>({error:null,data:table==='blog_posts'?[parent]:table==='blog_post_revisions'?[revision]:[]}));
    assert.deepEqual((await readPublicIndex(list,new Date(now).toISOString())).posts,[]);
    const detail=client(table=>({error:null,data:table==='blog_posts'?parent:null}));
    assert.equal(await readPublicArticle(detail,post.slug,new Date(now).toISOString()),null);
    assert.equal(detail.calls.length,1);
  }
});
