import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnose} from './offline-smoke.mjs';
test('migration is a planned pause, never a repair trigger',()=>{
 const r=diagnose({trinity_mode:'migration'});
 assert.equal(r.trinity.status,'planned_pause');
 assert.equal(r.api_requests,0);
 assert.equal(r.production_writes,0);
 assert.equal(r.live_checks_performed,false);
});
test('provider restriction stays paused',()=>{
 assert.equal(diagnose({trinity_mode:'provider_restricted'}).trinity.status,'planned_pause');
});
test('production mode does not invent live health',()=>{
 const r=diagnose({trinity_mode:'production'});
 assert.equal(r.trinity.status,'requires_evidence');
 assert.equal(r.other_services.discord,'not_checked');
});
test('unknown mode fails closed',()=>{
 assert.throws(()=>diagnose({trinity_mode:'unknown'}));
});
