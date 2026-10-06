import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {TRIAL_ARTICLES,TRIAL_SOURCE_HASHES,getTrialArticle} from '../../lib/blog/trialArticles.mjs';
import {validateDocument} from '../../lib/blog/document.mjs';
import {duePublicPost,articleStructuredData} from '../../lib/blog/seo.mjs';
import {characterImage} from '../../lib/blog/characterAssets.mjs';
import {GUIDE_ARTICLES} from '../../app/guide/guideData.js';
import {dataLabArticles} from '../../app/data-lab/articles.js';
const read=path=>readFileSync(new URL(`../../${path}`,import.meta.url),'utf8');
test('exactly four schema-valid editorial trials have no public state or dates',()=>{
 assert.equal(TRIAL_ARTICLES.length,4);assert.equal(new Set(TRIAL_ARTICLES.map(a=>a.post.slug)).size,4);
 assert.deepEqual(TRIAL_ARTICLES.map(a=>a.category.slug),['beginner','inside-course','women','longshot']);
 for(const a of TRIAL_ARTICLES){validateDocument(a.document);assert.equal(a.document.noindex,true);assert.equal(a.post.first_published_at,null);assert.equal(a.post.last_published_at,null);assert.equal(duePublicPost(a.post),false);assert.deepEqual(articleStructuredData(a,{preview:true,env:'preview'}),[]);}
 assert.equal(getTrialArticle('not-real'),undefined);
});
test('source evidence matches actual versioned files, no copied guide paragraphs',()=>{
 for(const [file,hash] of Object.entries(TRIAL_SOURCE_HASHES))assert.equal(createHash('sha256').update(read(file)).digest('hex'),hash);
 const paragraphs=[...GUIDE_ARTICLES.flatMap(a=>a.sections.flatMap(s=>s.paragraphs||[])),...dataLabArticles.flatMap(a=>a.sections.flatMap(s=>s.paragraphs||[]))].filter(p=>p.length>45);
 for(const a of TRIAL_ARTICLES){for(const c of a.claims)assert.ok(read(c.file).includes(c.anchor),c.description);const prose=JSON.stringify(a.document.blocks);for(const p of paragraphs)assert.ok(!prose.includes(p),`copied paragraph: ${p}`);assert.ok(!/[0-9]+(?:\.[0-9]+)?\s*[%％円]/.test(prose),'no invented measured rate/payout');}
});
test('beginner distributes speech across three humans, research scenes put mate checks before human views; real assets only',()=>{
 const turns=a=>a.document.blocks.filter(b=>b.type==='DIALOGUE_SCENE').flatMap(b=>b.data.turns);
 assert.deepEqual([...new Set(turns(TRIAL_ARTICLES[0]).map(t=>t.character))].sort(),['hatsune','ichika','kiina']);
 for(const [i,mate,human] of [[1,'ichimaru','ichika'],[2,'hatsukoro','hatsune'],[3,'kiimoko','kiina']]){const speech=turns(TRIAL_ARTICLES[i]);assert.equal(speech[0].character,mate);assert.equal(speech[1].character,human);assert.deepEqual([...new Set(speech.map(t=>t.character))].sort(),[mate,human].sort());}
 for(const a of TRIAL_ARTICLES)for(const turn of turns(a))assert.ok(existsSync(new URL(`../../public${characterImage(turn.character,turn.pose)}`,import.meta.url)));
});
test('Preview import boundary, sources, takeaways and themed CTAs preserve isolation',()=>{
 const runtimeFiles=['lib/blog/publicIndex.mjs','lib/blog/publicArticle.mjs','lib/blog/publicServer.js','app/blog/page.js','app/sitemap.js'];
 for(const file of runtimeFiles)assert.ok(!read(file).includes('trialArticles'));
 for(const route of ['app/blog/preview/trials/page.js','app/blog/preview/trials/[slug]/page.js']){
  const source=read(route);assert.match(source,/notFound\(\)/);assert.match(source,/index:false,follow:false/);assert.ok(source.indexOf('notFound()')<source.indexOf("await import("));
 }
 for(const a of TRIAL_ARTICLES){const blocks=a.document.blocks;for(const placement of ['takeaways','summary','sources'])assert.ok(blocks.some(b=>b.data.placement===placement));assert.ok(blocks.some(b=>b.type==='RELATED_ARTICLES'));assert.ok(blocks.some(b=>b.type==='CTA'&&b.data.href==='/today'));assert.ok(a.sources.length>=2);}
 assert.ok(!TRIAL_ARTICLES[0].document.blocks.some(b=>b.type==='DATA_CHECK'),'optional boxes are not forced');
});
