import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyResultLayer as classify } from './openapi-result-quarantine.prototype.mjs';

const valid = () => ({ result: {
  racers: { 1: { place_number: 1 }, 2: { place_number: 2 }, 3: { place_number: 3 } },
  payouts: { trifecta: [{ combination: '1-2-3', amount: 1200 }] }
}});
test('Q-classifier: absent result is pending, valid result accepted', () => {
  assert.equal(classify({}).status, 'PENDING');
  assert.equal(classify({ result: null }).status, 'PENDING');
  assert.equal(classify(valid()).status, 'ACCEPT');
});
test('Q-classifier: multi-payout does not silently truncate', () => {
  const x=valid(); x.result.payouts.trifecta.push({ combination:'1-3-2', amount:1000 });
  assert.deepEqual(classify(x), { status:'QUARANTINE', reason:'MULTIPLE_PAYOUTS', field:'trifecta' });
});
test('Q-classifier: incomplete or malformed payout is quarantined', () => {
  const x=valid(); delete x.result.payouts.trifecta[0].amount;
  assert.equal(classify(x).reason,'INCOMPLETE_PAYOUT');
  x.result.payouts.trifecta[0].amount='not-a-number';
  assert.equal(classify(x).reason,'PAYOUT_AMOUNT_INVALID');
  x.result.payouts.trifecta=null;
  assert.equal(classify(x).reason,'PAYOUT_COLLECTION_INVALID');
});
test('Q-classifier: payout with no boat result is quarantined', () => {
  const x=valid(); delete x.result.racers;
  assert.equal(classify(x).reason,'PAYOUT_WITHOUT_FINISH');
});
test('Q-classifier: tied finish is quarantined', () => {
  const x=valid(); x.result.racers[2].place_number=1;
  assert.equal(classify(x).reason,'TIED_FINISH');
});
test('Q-classifier: malformed nested data is quarantined', () => {
  assert.equal(classify({ result: [] }).reason,'RESULT_INVALID');
  assert.equal(classify({ result: { payouts: [] } }).reason,'PAYOUTS_INVALID');
  assert.equal(classify({ result: { racers: [] } }).reason,'FINISH_INVALID');
  assert.equal(classify({ result: { racers: { 1: null } } }).reason,'FINISH_BOAT_INVALID');
});
test('Q-classifier: input is not mutated', () => {
  const x=valid(), before=structuredClone(x);
  classify(x);
  assert.deepEqual(x,before);
});
