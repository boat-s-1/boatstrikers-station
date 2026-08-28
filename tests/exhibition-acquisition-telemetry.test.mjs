import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { acquisitionReason, acquisitionRecord, trackExhibitionFetch } from '../lib/exhibitionAcquisitionTelemetry.js';
const race={raceDate:'2026-08-28',courseCode:'05',raceNo:1};
for(const [error,code] of Object.entries({upstream_timeout:'timeout','fetch failed':'network',http_503:'http',reference_date_mismatch:'date_mismatch',source_identity_mismatch:'identity_mismatch',source_identity_missing:'identity_missing',six_unique_boats_required:'incomplete_boats',measurements_incomplete_or_invalid:'incomplete_values',timing_layout_changed:'layout',official_adapter_not_verified:'unsupported',not_published:'not_published',official_original_tenji_not_available:'unavailable',unrecognised:'unknown'})) test(`classifies ${error}`,()=>assert.equal(acquisitionReason({ok:false,error}),code));
test('empty results are never presumed unpublished',()=>assert.equal(acquisitionReason({ok:false,rows:[]}), 'unknown'));
test('only whitelisted details persisted; source failures not confused',()=>{
 const r=acquisitionRecord(race,'kiina',{ok:false,reason:'not_published',url:'https://x?secret=SECRET',diagnostics:{boaters:{reason:'not_published'},official:{error:'official_original_tenji_not_available',attempts:[{status:503,url:'SECRET'}]},secret:{message:'SECRET'}}},'start','end');
 assert.equal(JSON.stringify(r).includes('SECRET'),false); assert.deepEqual(r.source_results.map(s=>s.code),['not_published','http']); assert.equal(r.course_code,5);
});
test('successful fallback is success even with earlier transport failures',()=>assert.equal(acquisitionReason({ok:true,error:'timeout'}),'ready'));
function client(error=null,throws=false) {
 const calls=[];
 return {calls,rpc(name,args){
  calls.push({name,args});
  return {abortSignal(signal){assert.ok(signal instanceof AbortSignal);return throws?Promise.reject(new Error('SECRET')):Promise.resolve({error});}};
 }};
}
test('records and returns exact original result, never runs other RPCs',async()=>{const c=client(),result={ok:true,rows:[{boatNo:1}],sourceKind:'official'};assert.equal(await trackExhibitionFetch(c,'ichika',race,async()=>result),result);assert.equal(c.calls[0].name,'bs_record_exhibition_acquisition');assert.equal(c.calls[0].args.p_record.reason_code,'ready');});
test('logging failure cannot stop collection, error logs are fixed safe strings',async()=>{for(const c of [client({message:'SECRET'}),client(null,true)]) {const logs=[],result={ok:false,error:'timeout'};assert.equal(await trackExhibitionFetch(c,'hatsune',race,async()=>result,{}, {warn:m=>logs.push(m)}),result);assert.deepEqual(logs,['exhibition_acquisition_record_failed']);}});
test('fetch exceptions are recorded then rethrown unchanged',async()=>{const c=client(),error=new Error('fetch failed');await assert.rejects(trackExhibitionFetch(c,'kiina',race,async()=>{throw error;}),e=>e===error);assert.equal(c.calls[0].args.p_record.reason_code,'network');});
test('all three production consumers tracked, no notification logic in telemetry',()=>{for(const [path,consumer] of [['exhibition-alerts','kiina'],['ichika-hidden-escape','ichika'],['hatsune-womens-inner-break','hatsune']]) {const code=fs.readFileSync(new URL(`../app/api/cron/${path}/route.js`,import.meta.url),'utf8');assert.ok(code.includes(`fetchTrackedOriginalTenji(supabase,"${consumer}",`));assert.equal(code.includes('await fetchBestOriginalTenji('),false);} });
