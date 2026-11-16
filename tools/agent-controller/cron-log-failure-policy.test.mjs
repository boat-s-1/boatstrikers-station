import test from 'node:test';
import assert from 'node:assert/strict';
import {decideCronLogFailure} from './cron-log-failure-policy.mjs';
for(const pipelineResult of ['success','partial','error']) {
 test(pipelineResult+' with failed log never retries or republishes',()=>{
  const r=decideCronLogFailure({pipelineResult,logUpdateConfirmed:false});
  assert.equal(r.retry_pipeline,false);assert.equal(r.republish_news,false);assert.equal(r.operator_review,true);assert.equal(r.end_to_end_health,'unknown');
 });
}
test('successful log and pipeline can be reported but not live verified',()=>assert.equal(decideCronLogFailure({pipelineResult:'success',logUpdateConfirmed:true}).end_to_end_health,'reported_success'));
test('partial pipeline remains unknown even when logged',()=>assert.equal(decideCronLogFailure({pipelineResult:'partial',logUpdateConfirmed:true}).end_to_end_health,'unknown'));
test('invalid pipeline status is rejected',()=>assert.throws(()=>decideCronLogFailure({pipelineResult:'running',logUpdateConfirmed:true})));
test('missing confirmation is rejected',()=>assert.throws(()=>decideCronLogFailure({pipelineResult:'success'})));
