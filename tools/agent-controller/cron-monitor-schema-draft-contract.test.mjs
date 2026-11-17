import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../../docs/audit/sql/agent-monitor-schema-DRAFT-DO-NOT-RUN.sql',import.meta.url),'utf8');
const count=(pattern)=>(sql.match(pattern)||[]).length;
test('design is explicitly not for execution',()=>assert.match(sql,/DO NOT EXECUTE IN PRODUCTION/));
test('exactly one rolled-back transaction',()=>{assert.equal(count(/^BEGIN;$/gm),1);assert.equal(count(/^ROLLBACK;$/gm),1);assert.doesNotMatch(sql,/^COMMIT;/m)});
test('exactly three tables',()=>assert.equal(count(/^CREATE TABLE agent_monitor\./gm),3));
test('one start per attempt',()=>assert.match(sql,/CREATE UNIQUE INDEX attempt_events_one_start/));
test('unique incident reservation',()=>assert.match(sql,/incident_key text PRIMARY KEY/));
test('unique outbox incident',()=>assert.match(sql,/CREATE UNIQUE INDEX notification_outbox_one_per_incident/));
test('outbox foreign key',()=>assert.match(sql,/REFERENCES agent_monitor\.incident_reservations/));
for(const name of ['attempt_events','incident_reservations','notification_outbox'])test(name+' RLS enabled',()=>assert.ok(sql.includes('ALTER TABLE agent_monitor.'+name+' ENABLE ROW LEVEL SECURITY;')));
test('no grants',()=>assert.doesNotMatch(sql,/^GRANT\s+/im));
test('no scheduler',()=>assert.doesNotMatch(sql,/cron\.schedule\s*\(/i));
test('no deletion',()=>assert.doesNotMatch(sql,/^DELETE\s+FROM\s+/im));
test('no public API view',()=>assert.doesNotMatch(sql,/CREATE\s+(OR\s+REPLACE\s+)?VIEW\s+public\./i));
test('no secrets or article bodies',()=>assert.doesNotMatch(sql,/\b(api_key|webhook_url|article_body|secret_value)\s+text\b/i));
test('all identifiers are constrained text, not uuid',()=>{
 assert.doesNotMatch(sql,/\b(event_id|attempt_id|outbox_id) uuid\b/);
 for(const name of ['event_id','attempt_id','incident_key','outbox_id'])assert.match(sql,new RegExp(name+' text (?:PRIMARY KEY|NOT NULL) CHECK'));
});
test('all five ID checks are closed',()=>{
 const lines=sql.split('\n').filter(line=>/^ (?:event_id|attempt_id|incident_key|outbox_id) text /.test(line));
 assert.equal(lines.length,5);
 for(const line of lines){assert.ok(line.includes('CHECK ('),line);assert.ok(line.trimEnd().endsWith("$'),")||line.trimEnd().endsWith("$')"),line);}
});
