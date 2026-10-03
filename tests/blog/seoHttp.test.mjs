// Optional integration suite against a running production/Preview server.
// BLOG_SEO_TEST_ORIGIN=http://127.0.0.1:3109 node --test tests/blog/seoHttp.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
const origin=process.env.BLOG_SEO_TEST_ORIGIN;
const preview=process.env.BLOG_SEO_TEST_ENV==='preview';
const options={skip:!origin};
async function page(path){const r=await fetch(new URL(path,origin),{headers:{'User-Agent':'Googlebot'}});return {r,html:await r.text()};}
test('HTTP canonical and OGP use the production domain, never the test/Preview domain',options,async()=>{
  const {r,html}=await page('/blog');assert.equal(r.status,200);
  assert.match(html,/<link rel="canonical" href="https:\/\/www\.boat-strike\.online\/blog"/);
  assert.match(html,/<meta property="og:image" content="https:\/\/www\.boat-strike\.online\/blog\/og"/);
  assert.match(html,new RegExp(`<meta name="robots" content="${preview?'noindex':'index'}, follow"`));
});
test('HTTP search pages are noindex with canonical BLOG root',options,async()=>{
  const {r,html}=await page('/blog?q=展示');assert.equal(r.status,200);
  assert.match(html,/<meta name="robots" content="noindex, follow"/);
  assert.match(html,/<link rel="canonical" href="https:\/\/www\.boat-strike\.online\/blog"/);
});
test('HTTP author archive declares editorial character identity and correct canonical',options,async()=>{
  const {r,html}=await page('/blog/authors/ichika');assert.equal(r.status,200);
  assert.match(html,/編集キャラクター/);assert.match(html,/<link rel="canonical" href="https:\/\/www\.boat-strike\.online\/blog\/authors\/ichika"/);
});
test('HTTP safe fallback OGP is a real 1200x630 PNG',options,async()=>{
  const r=await fetch(new URL('/blog/og',origin));assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/image\/png/);
  const bytes=Buffer.from(await r.arrayBuffer());assert.equal(bytes.subarray(1,4).toString(),'PNG');
  assert.equal(bytes.readUInt32BE(16),1200);assert.equal(bytes.readUInt32BE(20),630);
});
