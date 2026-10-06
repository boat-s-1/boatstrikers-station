import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const origin=process.env.BLOG_INTEGRATION_TEST_ORIGIN;
const options={skip:!origin};
test('public directories, search and zero-data archives render, unknown articles/tags fail closed',options,async()=>{
 for(const path of ['/blog','/blog/categories','/blog/categories/beginner','/blog/tags','/blog/authors',...['ichika','hatsune','kiina','editorial'].map(a=>`/blog/authors/${a}`),'/blog?q=展示']) {
  const r=await fetch(origin+path);assert.equal(r.status,200,path);const html=await r.text();assert.ok(!html.includes('/blog/preview/trials/'),path);assert.match(html,/BOATSTRIKERS/);
 }
 for(const path of ['/blog/articles/not-a-real-post','/blog/tags/not-a-real-tag']) assert.equal((await fetch(origin+path)).status,404,path);
});
test('admin authentication and write gates reject unauthenticated access and private image retrieval',options,async()=>{
 const r=await fetch(origin+'/admin/blog',{redirect:'manual'});assert.equal(r.status,307);assert.match(r.headers.get('location'),/admin-login/);
 const media=await fetch(origin+'/api/admin/blog/media/80000000-0000-4000-8000-000000000001');assert.ok([401,503].includes(media.status));assert.match(media.headers.get('cache-control'),/no-store/);assert.match(media.headers.get('x-robots-tag'),/noindex/);
});
test('locally authenticated admin renders disabled zero-data/new editor and all tabs without a BLOG DB', {skip:!origin||!process.env.BLOG_LOCAL_TEST_SECRET},async()=>{
 const timestamp=Math.floor(Date.now()/1000);const sign=crypto.createHmac('sha256',process.env.BLOG_LOCAL_TEST_SECRET).update(String(timestamp)).digest('hex');
 const headers={cookie:`bs_admin_sync=${timestamp}.${sign}`};
 for(const path of ['/admin/blog','/admin/blog/new']){const r=await fetch(origin+path,{headers});assert.equal(r.status,200);const html=await r.text();assert.match(html,/noindex/);assert.ok(!html.includes('service_role'));if(path.endsWith('/new'))for(const label of ['基本情報','本文ブロック','SEO','公開設定','画像','下書きを作成'])assert.ok(html.includes(label));}
 const r=await fetch(origin+'/api/admin/blog/posts',{method:'POST',headers:{...headers,origin,'content-type':'application/json'},body:'{}'});assert.ok([403,503].includes(r.status));
});
