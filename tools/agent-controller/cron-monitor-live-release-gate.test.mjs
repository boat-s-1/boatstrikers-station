import test from 'node:test';
import assert from 'node:assert/strict';
import {assessLiveReleaseGate,REQUIRED_LIVE_EVIDENCE} from './cron-monitor-live-release-gate.mjs';
const assess=assessLiveReleaseGate;
test('missing evidence is HOLD',()=>{const r=assess();assert.equal(r.decision,'HOLD');assert.equal(r.missingEvidence.length,REQUIRED_LIVE_EVIDENCE.length);assert.equal(r.deployAllowed,false)});
test('self-reported boolean does not count',()=>{const r=assess({evidence:{source_authentication:true}});assert.ok(r.missingEvidence.includes('source_authentication'))});
test('synthetic CI does not count',()=>{const r=assess({evidence:{source_authentication:{kind:'synthetic_ci',verified:true,reference:'https://example.test/ci',verifiedBy:'ci'}}});assert.ok(r.missingEvidence.includes('source_authentication'))});
test('live claim without independent verifier does not count',()=>{const r=assess({evidence:{source_authentication:{kind:'independently_verified_live',verified:true,reference:'https://example.test/evidence'}}});assert.ok(r.missingEvidence.includes('source_authentication'))});
test('live evidence is not automatic authorization',()=>{const evidence=Object.fromEntries(REQUIRED_LIVE_EVIDENCE.map(key=>[key,{kind:'independently_verified_live',verified:true,reference:'https://example.test/evidence/'+key,verifiedBy:'independent-reviewer'}]));const r=assess({evidence});assert.deepEqual(r.missingEvidence,[]);assert.equal(r.reason,'manual_release_authorization_required');assert.equal(r.deployAllowed,false);assert.equal(r.productionWriteAllowed,false);assert.equal(r.sendAllowed,false)});
