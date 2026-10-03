import test from 'node:test';
import assert from 'node:assert/strict';
const origin=process.env.BLOG_NAV_TEST_ORIGIN;
test('Preview navigation is isolated, supplies real target links and article has only two theme CTAs',{skip:!origin},async()=>{
 const response=await fetch(`${origin}/blog/preview/navigation`);assert.equal(response.status,200);const html=await response.text();
 assert.match(html,/noindex/);for(const path of ['/today','/ichika','/hatsune','/kiina','/guide','/how-to-use','/library/stadium/shimonoseki','/races'])assert.ok(html.includes(`href="${path}"`));
 const article=await fetch(`${origin}/blog/preview/article`);assert.equal(article.status,200);const body=await article.text();
 const cta=body.match(/data-blog-placement="article-theme-cta">([\s\S]*?)<\/div>/)?.[1];assert.ok(cta);assert.equal((cta.match(/<a /g)||[]).length,2);assert.match(cta,/href="\/guide"/);assert.match(cta,/href="\/how-to-use"/);
});
test('public blog empty state contains no Preview fixture article links',{skip:!origin},async()=>{
 const html=await (await fetch(`${origin}/blog`)).text();assert.ok(!html.includes('href="/blog/preview'));assert.ok(!html.includes('href="/blog/articles/'));assert.match(html,/aria-label="RACEとBLOG"/);
});
