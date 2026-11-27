import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareBrdbWithOfficial } from './brdb-official-parity.mjs';

const race = {race_date:'2026-11-20',course_code:6,race_no:1};
const records = Array.from({length:6},(_,i)=>({SOPDT:'20261117',OPDT:'20261120',
  RCOURSECD:'06',RNO:'01',TEINO:String(i+1),ENTNO:String(4001+i).padStart(5,'0')}));
const officialEntries = records.map((row,i)=>({...race,boat_no:i+1,racer_registration_no:String(4001+i)}));
const input = {targetDate:'20261120',records,officialRaces:[race],officialEntries};
test('a complete independent official roster permits only offline parity',()=>{
  assert.deepEqual(compareBrdbWithOfficial(input),{status:'MATCHED_OFFLINE_ONLY',races:1,boats:6});
});
test('a missing race or changed registration holds without returning data',()=>{
  for(const change of [
    {officialRaces:[]},
    {officialEntries:officialEntries.slice(0,5)},
    {officialEntries:officialEntries.map((row,i)=>i===0?{...row,racer_registration_no:'4999'}:row)},
    {records:records.slice(0,5)},
    {records:records.map((row,i)=>i===0?{...row,ENTNO:'04999'}:row)},
  ]) {
    const result=compareBrdbWithOfficial({...input,...change});
    assert.equal(result.status,'HOLD');
    assert.equal('rows' in result,false);
  }
});
