import test from 'node:test';
import assert from 'node:assert/strict';
import {planQuarantinedResults as plan} from './openapi-quarantine-plan.prototype.mjs';
const capture={raceDate:'2026-11-18',sourceSha256:'a'.repeat(64),capturedAt:'2026-11-18T00:00:00Z'};
const boats=()=>Object.fromEntries(Array.from({length:6},(_,i)=>[String(i+1),{entry_number:i+1,number:1001+i}]));
const race=(n,result)=>({date:capture.raceDate,stadium_number:9,race_number:n,racers:boats(),...(result===undefined?{}:{result})});
const validResult=()=>({racers:{1:{place_number:1},2:{place_number:2},3:{place_number:3}},
 payouts:{trifecta:[{combination:'1-2-3',amount:1200}]}});
const fixture=()=>({programs:{stadiums:{9:{races:{1:race(1,validResult()),2:race(2,validResult())}}}}});
test('Q01/Q02 prototype: keep both valid programs; quarantine only malformed result',()=>{
 const x=fixture();
 x.programs.stadiums[9].races[2].result.payouts.trifecta.push({combination:'1-3-2',amount:1100});
 const before=structuredClone(x), out=plan(x,capture);
 assert.equal(out.programs.length,2);
 assert.equal(out.accepted.length,1);
 assert.equal(out.quarantine.length,1);
 assert.equal(out.quarantine[0].reason,'MULTIPLE_PAYOUTS');
 assert.equal(out.quarantine[0].raceNo,2);
 assert.deepEqual(x,before);
});
test('Q03 prototype: invalid six-boat program rejects entire snapshot',()=>{
 const x=fixture();delete x.programs.stadiums[9].races[2].racers[6];
 assert.throws(()=>plan(x,capture),/snapshot program invalid: six boats/);
});
test('Q04 prototype: result with no payout is quarantine, not pending',()=>{
 const x=fixture();delete x.programs.stadiums[9].races[2].result.payouts.trifecta[0].amount;
 const out=plan(x,capture);
 assert.equal(out.quarantine.length,1);assert.equal(out.pending.length,0);
});
test('pending race does not become quarantined',()=>{
 const x=fixture();delete x.programs.stadiums[9].races[2].result;
 const out=plan(x,capture);
 assert.equal(out.pending.length,1);assert.equal(out.quarantine.length,0);
});
test('source identity/date/registration gates reject entire snapshot',()=>{
 const x=fixture();x.programs.stadiums[9].races[2].date='2026-11-17';
 assert.throws(()=>plan(x,capture),/race identity/);
 const y=fixture();y.programs.stadiums[9].races[2].racers[6].number=1001;
 assert.throws(()=>plan(y,capture),/duplicate racer/);
 assert.throws(()=>plan(fixture(),{...capture,sourceSha256:'invalid'}),/capture metadata/);
});

test('capture metadata rejects impossible dates and timezone-ambiguous timestamps',()=>{
 for(const raceDate of ['2026-02-30','2026-13-01','2026-00-10','2026-11-31']){
   assert.throws(()=>plan(fixture(),{...capture,raceDate}),/capture metadata/);
 }
 for(const capturedAt of ['2026-11-18T00:00:00','not-a-date','2026-11-18T25:00:00Z']){
   assert.throws(()=>plan(fixture(),{...capture,capturedAt}),/capture metadata/);
 }
 assert.equal(plan(fixture(),{...capture,capturedAt:'2026-11-18T09:00:00+09:00'}).accepted.length,2);
});
