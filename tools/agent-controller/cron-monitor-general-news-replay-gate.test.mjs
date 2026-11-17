import test from 'node:test';
import assert from 'node:assert/strict';
import {assessGeneralNewsReplaySafety as gate} from './cron-monitor-general-news-replay-gate.mjs';
for(const status of ['success','partial','error','running']){
 test(status+' never authorizes automatic replay',()=>{
  const r=gate({priorRun:{status},sourceKeyUniquenessVerified:true,publicationIdempotencyVerified:true,operatorApproved:true});
  assert.equal(r.decision,'HOLD');assert.equal(r.automaticReplayAllowed,false);assert.equal(r.productionWriteAllowed,false);
 });
}
test('running requires independent completion verification',()=>assert.ok(gate({priorRun:{status:'running'}}).reasons.includes('completion_unverified')));
test('partial requires side effect reconciliation',()=>assert.ok(gate({priorRun:{status:'partial'}}).reasons.includes('partial_side_effects_possible')));
test('error may have committed before failure',()=>assert.ok(gate({priorRun:{status:'error'}}).reasons.includes('failed_run_may_have_committed')));
test('missing prior evidence holds',()=>assert.ok(gate().reasons.includes('unknown_prior_run')));
test('uniqueness and publication idempotency are separate',()=>{const r=gate({priorRun:{status:'partial'},sourceKeyUniquenessVerified:true});assert.ok(r.reasons.includes('publication_idempotency_unverified'));assert.ok(!r.reasons.includes('source_key_uniqueness_unverified'))});
test('approval cannot bypass independent executor',()=>assert.equal(gate({priorRun:{status:'error'},sourceKeyUniquenessVerified:true,publicationIdempotencyVerified:true,operatorApproved:true}).automaticReplayAllowed,false));
