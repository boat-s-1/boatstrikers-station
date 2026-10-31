import test from 'node:test';import assert from 'node:assert/strict';
import {validateGamagoriObservation,fetchGamagoriObservation,appendGamagoriObservation,gamagoriObservationSummary,findGamagoriOpenapiRace,gamagoriObservationUrls} from './gamagori-observations.mjs';
import {observationFixture,officialFixture} from '../tests/helpers/gamagori-observation-fixtures.mjs';
test('derived complete content yields content-only validation, no checked_at or sale permission supplied by client',()=>{
 const r=validateGamagoriObservation(observationFixture());assert.equal(r.validation_result,'verified_content');assert.equal(r.boats.length,6);assert.equal(r.sale_state,'unknown');assert(!('checked_at' in r));assert(!('collection_permitted' in r));
});
test('actual empty upstream and official empty exhibition never become verified on HTTP200',()=>{
 const r=validateGamagoriObservation(observationFixture(Date.now(),false));assert.equal(r.validation_result,'rejected');assert.equal(r.reason,'six_boat_preview_unverified');assert.equal(r.boats.length,6);assert(r.boats.every(b=>b.exhibition_time===null&&b.course===null));
});
test('actual cancelled index overrides six-slot data even without all sources',()=>{
 const f=observationFixture();f.date='2024-08-31';f.documents={index:{body:officialFixture('official-postponed-index-20240831.html')}};
 const r=validateGamagoriObservation(f);assert.equal(r.sale_state,'cancelled');assert.equal(r.validation_result,'rejected');
});
test('actual withdrawal K0 and all observed abnormal codes override otherwise consistent content',()=>{
 for(const code of ['K0','K1','F','S0','S1','S2','unknown']){const f=observationFixture();f.entries[3].result_code=code;assert.equal(validateGamagoriObservation(f).sale_state,'withdrawn');}
 const f=observationFixture();f.entries=JSON.parse(officialFixture('verified-db-preview-samples.json')).samples.find(s=>s.race_date==='2026-10-07').entries;assert.equal(validateGamagoriObservation(f).sale_state,'withdrawn');
});
test('missing HTTP date, old response, high Age, future observation and absent sources fail closed',()=>{
 for(const change of [f=>f.documents.choku.http_date=null,f=>f.documents.choku.http_date='2026-01-01',f=>f.documents.choku.age=61,f=>f.documents.choku.received_at=new Date(f.now+1).toISOString(),f=>delete f.documents.choku]){
  const f=observationFixture();change(f);assert.notEqual(validateGamagoriObservation(f).validation_result,'verified_content');
 }
});
test('source wrong date/boat/registration/course and conflicting official time cannot be verified',()=>{
 for(const change of [f=>f.documents.program.body='maintenance',f=>f.entries[0].registration='9999',f=>f.documents.index.body=officialFixture('official-postponed-index-20240831.html'),f=>f.documents.choku.body=f.documents.choku.body.replace('>6.8</td>','>6.9</td>'),f=>{const x=JSON.parse(f.documents.openapi.body);x.programs.stadiums['7'].races['1'].preview.racers['6'].course_number=1;f.documents.openapi.body=JSON.stringify(x);}]){
  const f=observationFixture();change(f);assert.equal(validateGamagoriObservation(f).validation_result,'rejected');
 }
});
test('public OpenAPI extraction is identity-scoped; arbitrary nesting is not accepted',()=>{
 const f=observationFixture(),json=JSON.parse(f.documents.openapi.body);assert.equal(findGamagoriOpenapiRace(json,f.date,1).race_number,1);assert.equal(findGamagoriOpenapiRace(json,f.date,2),null);assert.equal(findGamagoriOpenapiRace({races:[json]},f.date,1),null);
 assert.throws(()=>gamagoriObservationUrls('bad',1));assert.throws(()=>gamagoriObservationUrls(f.date,13));
});
test('bounded sequential fetch observes actual parser path, shared clock and spacing',async()=>{
 const f=observationFixture();let clock=f.now,urls=[],pauses=[];const expected=gamagoriObservationUrls(f.date,f.race);
 const r=await fetchGamagoriObservation({...f,now:()=>clock,sleep:async n=>{clock+=n;pauses.push(n)},fetcher:async(url,options)=>{
  urls.push(url);assert.equal(options.redirect,'error');assert(options.signal);const kind=Object.keys(expected).find(k=>expected[k]===url);return new Response(f.documents[kind].body,{headers:{date:new Date(clock).toUTCString()}});
 }});
 assert.equal(r.validation_result,'verified_content');assert.equal(urls.length,4);assert.deepEqual(pauses,[1500,1500,1500]);assert(r.sources.every(s=>s.html_sha256.length===64));
});
test('403 and network failure stop further sources; no retries amplify official traffic',async()=>{
 for(const fetcher of [async()=>new Response('',{status:403}),async()=>{throw Error('network')}]){let calls=0;const f=observationFixture();const r=await fetchGamagoriObservation({...f,now:()=>f.now,sleep:async()=>{},fetcher:async(...args)=>{calls++;return fetcher(...args)}});assert.equal(r.validation_result,'unavailable');assert.equal(calls,1);}
});
test('known withdrawal requires zero upstream fetches and persists only negative evidence',async()=>{
 const f=observationFixture();f.entries[3].result_code='K0';const r=await fetchGamagoriObservation({...f,now:()=>f.now,fetcher:async()=>{throw Error('must not fetch')}});assert.equal(r.sale_state,'withdrawn');assert.equal(r.sources.length,0);
});
test('source byte limit cancels the response before accepting a hash',async()=>{
 const f=observationFixture();const r=await fetchGamagoriObservation({...f,now:()=>f.now,sleep:async()=>{},fetcher:async()=>new Response('x'.repeat(800001),{headers:{date:new Date().toUTCString()}})});assert.equal(r.sources[0].error,'document_too_large');assert.equal(r.validation_result,'unavailable');
});
test('persistence uses dedicated append RPC; failure propagates without collection',async()=>{
 const r=validateGamagoriObservation(observationFixture());let calls=0;
 await appendGamagoriObservation({rpc:async(name,args)=>{calls++;assert.equal(name,'bsc_gamagori_record_observation');assert.equal(args.p_observation,r);return {data:{id:r.id},error:null};}},r);assert.equal(calls,1);
 await assert.rejects(appendGamagoriObservation({rpc:async()=>({error:{message:'do not print'}})},r),/observation_persistence_failed/);
});
test('latest failed observation remains visible while historical content success is not sale authorization',()=>{
 const old={recorded_at:'2026-10-31T05:00:00Z',checked_at:'2026-10-31T05:00:00Z',validation_result:'verified_content'},latest={recorded_at:'2026-10-31T05:01:00Z',checked_at:null,validation_result:'rejected'};
 const r=gamagoriObservationSummary([old,latest]);assert.equal(r.latest,latest);assert.equal(r.last_content_checked_at,old.checked_at);assert.equal(r.collection_permitted,false);
});
