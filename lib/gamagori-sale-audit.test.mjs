import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {inspectBoatraceSaleStatus} from './gamagori-sale-audit.mjs';
import {validateGamagoriObservation} from './gamagori-observations.mjs';
import {observationFixture,officialFixture} from '../tests/helpers/gamagori-observation-fixtures.mjs';
const html=readFileSync(new URL('../tests/fixtures/gamagori/official-sale-display-20261031-1418.html',import.meta.url),'utf8');
const sample=()=>({html,date:'2026-10-31',race:1,received_at:'2026-10-31T05:18:21.892Z',http_date:'Sat, 31 Oct 2026 05:18:21 GMT',now:Date.parse('2026-10-31T05:18:22Z')});
test('actual date/stadium row explicitly displays 1R onward sale-open with page update14:18',()=>{
 const r=inspectBoatraceSaleStatus(sample());assert.equal(r.state,'sale_open_observed');assert.equal(r.race_from,1);assert.equal(r.page_updated_at,'2026-10-31T05:18:00.000Z');assert.equal(r.collection_permitted,false);
});
test('sale text in another venue or wrong date cannot authorize Gamagori',()=>{
 for(const change of [s=>s.html=s.html.replace('text_place1_07.png','text_place1_09.png'),s=>s.html=s.html.replaceAll('hd=20261031','hd=20261030'),s=>s.html=s.html.replace('1R以降<br />発売中','発売予定'),s=>s.html=s.html.replace('1R以降<br />発売中','9R以降<br />発売中')]){const s=sample();change(s);assert.equal(inspectBoatraceSaleStatus(s).state,'unknown');}
});
test('duplicate venue rows, comment-only display and absent update time remain unknown',()=>{
 for(const change of [s=>s.html+=s.html,s=>s.html='<!--'+s.html.replace(/<!--.*?-->/g,'')+'-->',s=>s.html=s.html.replace('更新時間 14:18','更新時間 --:--')]){const s=sample();change(s);assert.equal(inspectBoatraceSaleStatus(s).state,'unknown');}
});
test('HTTP success and fresh receipt do not rescue stale page update, future time or old date',()=>{
 for(const change of [s=>s.now+=180000,s=>s.http_date=null,s=>s.now-=120000,s=>s.age=61,s=>s.date='2026-10-30']){const s=sample();change(s);assert.equal(inspectBoatraceSaleStatus(s).state,'unknown');}
});
test('negative venue status overrides a generic sale-open phrase elsewhere in the page',()=>{
 const s=sample();s.html=s.html.replace('1R以降<br />発売中','中止順延')+'<p>発売中</p>';assert.equal(inspectBoatraceSaleStatus(s).state,'cancelled_or_postponed');
});
test('actual Gamagori cancelled date remains rejected independently of any sale display',()=>{
 assert.equal(inspectBoatraceSaleStatus(sample()).state,'sale_open_observed');
 const f=observationFixture();f.date='2024-08-31';f.documents.index.body=officialFixture('official-postponed-index-20240831.html');assert.equal(validateGamagoriObservation(f).sale_state,'cancelled');
});
test('actual withdrawal K0 still blocks six-slot fixture despite observed venue sale',()=>{
 const f=observationFixture();f.entries[3].result_code='K0';assert.equal(inspectBoatraceSaleStatus(sample()).state,'sale_open_observed');assert.equal(validateGamagoriObservation(f).sale_state,'withdrawn');
});
