import test from 'node:test';
import assert from 'node:assert/strict';
import {assessCronMonitorEvidenceManifest,CRON_MONITOR_EVIDENCE_KEYS} from './cron-monitor-evidence-manifest.mjs';
const ref='https://github.com/boat-s-1/boatstrikers-station/pull/299';
const entry=(status='verified',environment='isolated')=>({status,environment,reference:ref});
test('missing evidence is HOLD',()=>{const r=assessCronMonitorEvidenceManifest();assert.equal(r.decision,'hold');assert.equal(r.missing.length,10);assert.equal(r.production_deployment_allowed,false)});
test('only isolated validated items are claimed, not all',()=>{
 const r=assessCronMonitorEvidenceManifest({evidence:{schema_execution:entry(),sequential_uniqueness:entry(),row_level_security:entry(),rollback:entry()}});
 assert.equal(r.claimed_verified.length,4);assert.ok(r.missing.includes('parallel_race'));assert.ok(r.missing.includes('crash_recovery'));assert.ok(r.missing.includes('delivery_receipt'));assert.equal(r.notification_delivery_allowed,false);
});
test('all claimed evidence still HOLD without independent attestation and approval',()=>{
 const evidence=Object.fromEntries(CRON_MONITOR_EVIDENCE_KEYS.map(k=>[k,entry()]));
 const r=assessCronMonitorEvidenceManifest({evidence});assert.equal(r.decision,'hold');assert.equal(r.next_step,'separate_explicit_release_approval');assert.equal(r.independently_authenticated,false);
});
for(const bad of [null,[],{evidence:{bad:entry()}},{evidence:{schema_execution:{...entry(),status:'yes'}}},{evidence:{schema_execution:{...entry(),reference:'https://example.com/fake'}}},{evidence:{schema_execution:{...entry(),environment:'production'}}},{evidence:{schema_execution:true}},{evidence:{schema_execution:{...entry(),secret:'no'}}}]){
 test('rejects malformed manifest '+String(bad),()=>assert.throws(()=>assessCronMonitorEvidenceManifest(bad)));
}
test('failed evidence never passes',()=>{const r=assessCronMonitorEvidenceManifest({evidence:{parallel_race:entry('failed')}});assert.deepEqual(r.unverified,['parallel_race']);assert.equal(r.decision,'hold')});
test('not tested evidence never passes',()=>{const r=assessCronMonitorEvidenceManifest({evidence:{crash_recovery:entry('not_tested')}});assert.deepEqual(r.unverified,['crash_recovery'])});
