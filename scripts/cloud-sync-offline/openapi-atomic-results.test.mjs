import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAtomicResultPayload} from '../../lib/openapi-atomic-results.mjs';
const date='2026-11-17';
function fixture(result) {
 return {programs:{stadiums:{9:{stadium_number:9,races:{1:{race_number:1,date,
 racers:Object.fromEntries(Array.from({length:6},(_,i)=>[i+1,{entry_number:i+1}])),result}}}}}};
}
test('normal result maps all fields to existing SQL RPC schema',()=>{
 const src=fixture({technique_number_source:'逃げ',technique_number:1,
 payouts:{trifecta:[{combination:'1-2-3',amount:1230}],exacta:[{combination:'1-2',amount:300}]},
 racers:{1:{entry_number:1,place_number:1,place_number_source:'1着',course_number:1,start_timing:0.12},
 2:{entry_number:2,place_number:2},3:{entry_number:3,place_number:3}}});
 const p=buildAtomicResultPayload(src,date);
 assert.equal(p.results.length,1);assert.equal(p.entries.length,3);
 assert.equal(p.results[0].trifecta_payout,1230);
 assert.equal(p.results[0].first_boat,1);
 assert.equal(p.results[0].third_boat,3);
 assert.equal(p.entries[0].actual_st,0.12);
 assert.equal(p.entries[0].finish_place,'1着');
});
test('no completed result produces no rows',()=>{
 const p=buildAtomicResultPayload(fixture(null),date);
 assert.deepEqual(p,{results:[],entries:[]});
});
test('wrong result date rejected',()=>{
 assert.throws(()=>buildAtomicResultPayload(fixture({racers:{}}),'2026-11-16'),/date/);
});
test('duplicate result boat rejected',()=>{
 const src=fixture({racers:{1:{entry_number:1},2:{entry_number:1}}});
 assert.throws(()=>buildAtomicResultPayload(src,date),/duplicate/);
});
test('invalid result racer collection rejected',()=>{
 assert.throws(()=>buildAtomicResultPayload(fixture({racers:[]}),date),/racers/);
});
test('invalid result boat rejected',()=>{
 assert.throws(()=>buildAtomicResultPayload(fixture({racers:{7:{entry_number:7}}}),date),/boat/);
});

test('result boat key must agree with entry number and program boat',()=>{
 const src=fixture({racers:{1:{entry_number:2}}});
 assert.throws(()=>buildAtomicResultPayload(src,date),/boat/);
});
test('stadium and race key aliases cannot silently change identity',()=>{
 const src=fixture({racers:{}});
 src.programs.stadiums['9'].stadium_number=10;
 assert.throws(()=>buildAtomicResultPayload(src,date),/course/);
});
test('missing program boat rejects result ingestion',()=>{
 const src=fixture({racers:{}});
 delete src.programs.stadiums['9'].races['1'].racers['6'];
 assert.throws(()=>buildAtomicResultPayload(src,date),/six program boats/);
});

test('pre-settlement empty result object never creates a result-only race',()=>{
 assert.deepEqual(buildAtomicResultPayload(fixture({racers:{},payouts:{}}),date),
   {results:[],entries:[]});
});
test('pre-settlement start timing without placings never creates results',()=>{
 const p=buildAtomicResultPayload(fixture({racers:{
  1:{entry_number:1,start_timing:0.13},
  2:{entry_number:2,start_timing:0.15}}}),date);
 assert.deepEqual(p,{results:[],entries:[]});
});
test('settled payout without racer details fails closed',()=>{
 assert.throws(()=>buildAtomicResultPayload(fixture({
  racers:{},payouts:{trifecta:[{combination:'1-2-3',amount:1000}]}
 }),date),/missing racer details/);
});

test('duplicate official finish place fails closed',()=>{
 const src=fixture({racers:{
  1:{entry_number:1,place_number:1},
  2:{entry_number:2,place_number:1}}});
 assert.throws(()=>buildAtomicResultPayload(src,date),/duplicate result placing/);
});
test('unique official finish places remain accepted',()=>{
 const src=fixture({racers:{
  1:{entry_number:1,place_number:1},
  2:{entry_number:2,place_number:2}}});
 const p=buildAtomicResultPayload(src,date);
 assert.equal(p.results[0].first_boat,1);
 assert.equal(p.results[0].second_boat,2);
});
