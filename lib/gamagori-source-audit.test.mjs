import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {inspectGamagoriIndex,inspectGamagoriNavigation,inspectOpenapiPreview,inspectGamagoriChoku,describeGamagoriDatabasePreview,isGamagoriEntryBlocked} from './gamagori-source-audit.mjs';
const read=n=>readFileSync(new URL('../tests/fixtures/gamagori/'+n,import.meta.url),'utf8');
const raw=JSON.parse(read('openapi-empty-preview-20261031-01.json'));
const samples=JSON.parse(read('verified-db-preview-samples.json')).samples;
test('actual dated normal index proves schedule only, never live sale or no cancellation',()=>{
 const r=inspectGamagoriIndex(read('official-index-20261031.html'),{date:'2026-10-31',race:1});assert.equal(r.state,'schedule_published');assert.equal(r.sale_state,'unknown');assert.equal(r.collection_permitted,false);
});
test('actual cancelled day keeps twelve programs but explicit cyushi overrides them',()=>{
 const r=inspectGamagoriIndex(read('official-postponed-index-20240831.html'),{date:'2024-08-31',race:1});assert.equal(r.state,'cancelled');assert.equal(r.collection_permitted,false);
});
test('wrong date, invalid index and absent target race remain unknown',()=>{
 for(const [s,args] of [[read('official-index-20261031.html'),{date:'2026-10-30',race:1}],['maintenance',{date:'2026-10-31',race:1}],[read('official-index-20261031.html'),{date:'2026-10-31',race:12}]])assert.equal(inspectGamagoriIndex(s,args).state,'unknown');
});
test('actual date/race JS has pointers, not a live-state or update-time contract',()=>{
 assert.equal(inspectGamagoriNavigation(read('official-today-date-20261031.js')).target_date,'20261031');
 const r=inspectGamagoriNavigation(read('official-result-race-20261031.js'));assert.equal(r.latest_odds_race,1);assert.equal(r.latest_result_race,0);assert.equal(r.collection_permitted,false);
 assert.equal(inspectGamagoriNavigation('function funcOddsRacenum(){ throw Error("do not execute"); }').latest_odds_race,null);
});
test('actual OpenAPI six-slot empty shell produces zero input rows and no permission',()=>{
 const r=inspectOpenapiPreview(raw.race,{date:'2026-10-31',raceNo:1,entries:raw.db_entries});assert.equal(r.state,'empty_preview_shell');assert.equal(r.preview_slots,6);assert.equal(r.sync_input_rows,0);assert.equal(r.complete_preview_values,0);assert.equal(r.collection_permitted,false);
});
test('zero-valued tilt is retained as a sync row, but is not a complete preview',()=>{
 const r=structuredClone(raw.race);r.preview.racers['1'].tilt_adjustment=0;
 const p=inspectOpenapiPreview(r,{date:'2026-10-31',raceNo:1,entries:raw.db_entries});assert.equal(p.state,'partial_preview');assert.equal(p.sync_input_rows,1);assert.equal(p.complete_preview_values,0);
});
test('six valid values alone still do not grant collection or invent a source updated timestamp',()=>{
 const r=structuredClone(raw.race);for(const b of Object.values(r.preview.racers)){b.exhibition_time=6.8;b.course_number=b.entry_number;}
 const p=inspectOpenapiPreview(r,{date:'2026-10-31',raceNo:1,entries:raw.db_entries});assert.equal(p.state,'six_preview_values');assert.equal(p.per_race_updated_at,null);assert.equal(p.collection_permitted,false);
 r.preview.racers['6'].course_number=1;assert.equal(inspectOpenapiPreview(r,{date:'2026-10-31',raceNo:1,entries:raw.db_entries}).state,'partial_preview');
});
test('OpenAPI wrong day or changed registration/boat mapping is rejected',()=>{
 const args={date:'2026-10-31',raceNo:1,entries:raw.db_entries};assert.equal(inspectOpenapiPreview(raw.race,{...args,date:'2026-10-30'}).state,'identity_unverified');
 const r=structuredClone(raw.race);r.racers['1'].number=9999;assert.equal(inspectOpenapiPreview(r,args).state,'roster_mismatch');
 const duplicate=structuredClone(raw.race);duplicate.racers['6']=duplicate.racers['1'];assert.equal(inspectOpenapiPreview(duplicate,args).state,'roster_mismatch');
});
test('actual official choku distinguishes zero, six and five exhibition times by registered boat',()=>{
 const cases=[['official-choku-20261031-01.html','2026-10-31',1,raw.db_entries,0],['official-historical-choku-20261030-01.html','2026-10-30',1,samples.find(s=>s.race_date==='2026-10-30').entries,6],['official-withdrawn-choku-20261007-07.html','2026-10-07',7,samples.find(s=>s.race_date==='2026-10-07').entries,5]];
 for(const [name,date,race,entries,n] of cases){const result=inspectGamagoriChoku(read(name),{date,race,entries});assert.equal(result.exhibition_time_count,n);assert.equal(result.collection_permitted,false);if(n===6)assert(result.entries.every(e=>e.exhibition_time===entries.find(x=>x.boat_no===e.boat_no).exhibition_time));if(n===5)assert.equal(result.entries.find(e=>e.boat_no===4).exhibition_time,null);}
});
test('actual K0 sample and observed K1/S/F/unknown result codes block, normal 01..06 do not',()=>{
 const e=samples.find(s=>s.race_date==='2026-10-07').entries.find(e=>e.boat_no===4);assert.equal(e.result_code,'K0');assert(isGamagoriEntryBlocked(e));
 for(const result_code of ['K0','K1','F','S0','S1','S2','unknown'])assert(isGamagoriEntryBlocked({result_code}));
 for(const result_code of [null,'01','02','03','04','05','06'])assert.equal(isGamagoriEntryBlocked({result_code}),false);
});
test('value-change clocks plus successful global sync are not a per-race observation timestamp',()=>{
 const s=samples.find(x=>x.race_date==='2026-10-30'),now=Date.parse('2026-10-30T14:27:00Z');
 const r=describeGamagoriDatabasePreview({live_sync:new Date(now).toISOString(),races:[{race_no:1,entries:s.entries}]},'2026-10-30',now);
 assert.equal(r.live_job_recent,true);assert.equal(r.races[0].diagnosis,'observation_time_not_available');assert.equal(r.races[0].last_observed_at,null);assert.equal(r.races[0].preview_value_rows,6);assert.equal(r.collection_permitted,false);
});
