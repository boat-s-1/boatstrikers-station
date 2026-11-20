import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapBrdbProgramRoster } from './brdb-program-roster.mjs';

const sample = Array.from({length: 6}, (_, i) => ({ OPDT:'20261120', SOPDT:'20261117',
  RCOURSECD:'06', RNO:'01', TEINO:String(i+1), ENTNO:String(4001+i).padStart(5,'0') }));
test('six verified identities become candidates, preserving source input', () => {
  const mapped = mapBrdbProgramRoster(sample, '20261120');
  assert.equal(mapped.status, 'CANDIDATE_ONLY');
  assert.equal(mapped.rows.length, 6);
  assert.deepEqual(mapped.rows[0], {race_date:'2026-11-20',course_code:6,race_no:1,boat_no:1,racer_registration_no:'4001'});
  assert.equal(sample[0].ENTNO, '04001');
});
test('partial, duplicated, mismatched and impossible roster fails closed', () => {
  assert.equal(mapBrdbProgramRoster(sample.slice(0,5),'20261120').status,'HOLD_INCOMPLETE_ROSTER');
  assert.equal(mapBrdbProgramRoster([...sample,sample[0]],'20261120').status,'HOLD_DUPLICATE_BOAT');
  assert.equal(mapBrdbProgramRoster(sample.map((r,i)=>i===1?{...r,ENTNO:sample[0].ENTNO}:r),'20261120').status,'HOLD_INCOMPLETE_ROSTER');
  assert.equal(mapBrdbProgramRoster(sample.map((r,i)=>i===1?{...r,OPDT:'20261121'}:r),'20261120').status,'HOLD_INVALID_ROW');
  assert.equal(mapBrdbProgramRoster(sample.map((r,i)=>i===1?{...r,TEINO:'7'}:r),'20261120').status,'HOLD_INVALID_ROW');
  assert.equal(mapBrdbProgramRoster(sample.map((r,i)=>i===1?{...r,SOPDT:'20261109'}:r),'20261120').status,'HOLD_INVALID_ROW');
});
