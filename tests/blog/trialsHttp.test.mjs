import test from 'node:test';
import assert from 'node:assert/strict';
import {TRIAL_ARTICLES,trialHref} from '../../lib/blog/trialArticles.mjs';
const origin=process.env.BLOG_TRIAL_TEST_ORIGIN;
const production=process.env.BLOG_TRIAL_PRODUCTION==='1';
test('four editorial trials render only in Preview, every route is noindex or production 404',{skip:!origin},async()=>{
 for(const path of ['/blog/preview/trials',...TRIAL_ARTICLES.map(a=>trialHref(a.post.slug))]){
  const response=await fetch(`${origin}${path}`);assert.equal(response.status,production?404:200,path);const html=await response.text();assert.match(html,/noindex/);assert.match(response.headers.get('x-robots-tag')||'',/noindex/);
  if(!production){assert.ok(!html.includes('application/ld+json'));if(path==='/blog/preview/trials')assert.equal((html.match(/data-trial-slug=/g)||[]).length,4);}
 }
});
test('Preview research pairs, source links and RACE CTAs render real structured blocks',{skip:!origin||production},async()=>{
 for(const [i,speakers] of [[0,['ichika','hatsune','kiina']],[1,['ichimaru','ichika']],[2,['hatsukoro','hatsune']],[3,['kiimoko','kiina']]]){
  const article=TRIAL_ARTICLES[i];const html=await (await fetch(`${origin}${trialHref(article.post.slug)}`)).text();
  for(const speaker of speakers)assert.ok(html.includes(`data-speaker="${speaker}"`));
  for(const source of article.sources)assert.ok(html.includes(`href="${source.path}"`));
  assert.ok(html.includes('data-blog-placement="article-theme-cta"'));assert.ok(html.includes('href="/today"'));assert.ok(html.includes('この記事で分かること'));assert.ok(html.includes('出典・参考資料'));assert.ok(html.includes('公開日・更新日は未設定'));
 }
 assert.equal((await fetch(`${origin}/blog/preview/trials/not-real`)).status,404);
});
test('public index/search/sitemap never expose trial article titles or links',{skip:!origin||production},async()=>{
 for(const path of ['/blog','/blog?q=5アタマ']){
  const html=await (await fetch(`${origin}${path}`)).text();assert.ok(!html.includes('/blog/preview/trials'));
  for(const article of TRIAL_ARTICLES)assert.ok(!html.includes(article.document.title));
 }
});
