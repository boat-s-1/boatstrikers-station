import test from 'node:test';
import assert from 'node:assert/strict';
import {loadStadiumArticles} from '../lib/stadiumArticles.mjs';
import {collectorDiagnostic} from '../scripts/trinity/collector-diagnostics.mjs';
import {spawnSync} from 'node:child_process';
test('RSS 503 is unavailable, not a build exception',async()=>{
  const r=await loadStadiumArticles({parseURL:async()=>{throw Error('HTTP 503');}},'住之江');assert.deepEqual(r,{unavailable:true,articles:[]});
});
test('RSS successful empty feed remains distinguishable',async()=>{
  assert.deepEqual(await loadStadiumArticles({parseURL:async()=>({items:[]})},'住之江'),{unavailable:false,articles:[]});
});
test('malformed RSS fails gracefully',async()=>{
  assert.equal((await loadStadiumArticles({parseURL:async()=>({})},'住之江')).unavailable,true);
});
test('RSS filters, limits and preserves image/fallback',async()=>{
  const items=[{title:'別の場'},null,...Array.from({length:25},(_,i)=>({title:`住之江${i}`,link:`/fixture/${i}`,content:i===0?'<img src="/fixture.png">':null}))];
  const r=await loadStadiumArticles({parseURL:async()=>({items})},'住之江');assert.equal(r.articles.length,20);assert.equal(r.articles[0].image,'/fixture.png');assert.equal(r.articles[1].image,'/book-24-stadiums.jpg');
});
for(const stage of ['official_index','official_race','parse','intake_fetch','intake_decode','intake_status']) test(`diagnostic stage ${stage} excludes raw secrets`,()=>{
  const r=collectorDiagnostic(stage,{message:'secret-fixture',authorization:'Bearer fixture'},522);
  assert.equal(r.stage,stage);assert.equal(r.http_status,522);assert.doesNotMatch(JSON.stringify(r),/secret-fixture|Bearer/);
});
test('timeout and incomplete classification',()=>{
  assert.equal(collectorDiagnostic('parse',{code:'OFFICIAL_RACELIST_INCOMPLETE'}).failure,'source_incomplete');
  assert.equal(collectorDiagnostic('official_index',{name:'TimeoutError'}).failure,'timeout');
  assert.deepEqual(collectorDiagnostic('secret',{},999),{stage:'unknown',failure:'failure'});
});
for(const stage of ['official_index','official_race','parse']) test(`collector CLI diagnostic with mocked fetch: ${stage}`,()=>{
  const r=spawnSync(process.execPath,['--require','./scripts/batch1/deny-network.cjs','--require','./tests/fixtures/batch1-collector-preload.cjs','scripts/trinity/collect-official-previous-day.mjs','--dry-run','--probe','--date','2026-11-16','--max-races','1'],{
    cwd:new URL('../',import.meta.url),encoding:'utf8',env:{PATH:'/usr/bin:/bin',BATCH1_FIXTURE_STAGE:stage}});
  assert.equal(r.status,1,r.stderr);assert.ok((r.stdout+r.stderr).includes(`"stage":"${stage}"`));
  if(stage!=='parse')assert.ok((r.stdout+r.stderr).includes('"http_status":503'));
  assert.doesNotMatch(r.stdout,/"submitted":[1-9]/);
});
