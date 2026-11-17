import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {OUTBOX_STATES} from './cron-monitor-outbox-transition-guard.mjs';
const race = readFileSync(new URL('./isolated-postgres-race-ci.sh',import.meta.url),'utf8');
const db = readFileSync(new URL('./isolated-postgres-transition-ci.sh',import.meta.url),'utf8');
const extract = (text) => [...text.matchAll(/'([a-z_]+)'/g)].map(m=>m[1]);
test('disposable PostgreSQL outbox CHECK accepts exactly the app state set',()=>{
 const match = race.match(/delivery_state text NOT NULL CHECK \(delivery_state IN \(([^)]*)\)\)/);
 assert.ok(match,'outbox CHECK constraint not found');
 assert.deepEqual(new Set(extract(match[1])),new Set(OUTBOX_STATES));
});
test('database transition trigger enumerates every nonterminal application state',()=>{
 for(const state of OUTBOX_STATES.filter(s=>s!=='delivered')){
   assert.ok(db.includes("OLD.delivery_state='"+state+"'"),'missing DB source state: '+state);
 }
});
test('delivered remains terminal in DB trigger',()=>{
 assert.ok(db.includes('invalid outbox transition'));
 assert.equal(db.includes("OLD.delivery_state='delivered'"),false);
});
