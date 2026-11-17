import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../../docs/audit/sql/agent-monitor-schema-DRAFT-DO-NOT-RUN.sql',import.meta.url),'utf8');
test('design is explicitly not for execution',()=>assert.match(sql,/DO NOT EXECUTE IN PRODUCTION/));
test('schema draft is transaction wrapped and rolled back',()=>{assert.match(sql,/\bBEGIN;/);assert.match(sql,/\bROLLBACK;/);assert.doesNotMatch(sql,/\bCOMMIT;/)});
test('unique attempt start',()=>assert.match(sql,/CREATE UNIQUE INDEX attempt_events_one_start/));
test('unique incident reservation',()=>assert.match(sql,/incident_key text PRIMARY KEY/));
test('outbox unique incident',()=>assert.match(sql,/CREATE UNIQUE INDEX notification_outbox_one_per_incident/));
test('foreign key reservation',()=>assert.match(sql,/REFERENCES agent_monitor\.incident_reservations/));
test('row level security enabled for events',()=>assert.match(sql,/ALTER TABLE agent_monitor\.attempt_events ENABLE ROW LEVEL SECURITY/));
test('row level security enabled for reservations',()=>assert.match(sql,/ALTER TABLE agent_monitor\.incident_reservations ENABLE ROW LEVEL SECURITY/));
test('row level security enabled for outbox',()=>assert.match(sql,/ALTER TABLE agent_monitor\.notification_outbox ENABLE ROW LEVEL SECURITY/));
test('no broad grants',()=>assert.doesNotMatch(sql,/^GRANT\s+/im));
test('no automatic scheduler',()=>assert.doesNotMatch(sql,/cron\.schedule\s*\(/i));
test('no data deletion',()=>assert.doesNotMatch(sql,/^DELETE\s+FROM\s+/im));
test('no public API view',()=>assert.doesNotMatch(sql,/CREATE\s+(OR\s+REPLACE\s+)?VIEW\s+public\./i));
test('no secret or raw article columns',()=>assert.doesNotMatch(sql,/\b(api_key|webhook_url|article_body|secret_value)\s+text\b/i));

test('schema event and attempt identifiers match safe string IDs',()=>{assert.match(sql,/event_id text PRIMARY KEY CHECK/);assert.match(sql,/attempt_id text NOT NULL CHECK/);assert.doesNotMatch(sql,/\b(event_id|attempt_id|outbox_id) uuid\b/)});
test('outbox identifier matches safe string ID',()=>assert.match(sql,/outbox_id text PRIMARY KEY CHECK/));

test('draft has exactly one transaction and three table declarations',()=>{
 assert.equal((sql.match(/^BEGIN;$/gm)||[]).length,1);
 assert.equal((sql.match(/^ROLLBACK;$/gm)||[]).length,1);
 assert.equal((sql.match(/^CREATE TABLE agent_monitor\./gm)||[]).length,3);
});
test('identifier checks have closed regex strings and parentheses',()=>{
 const idChecks=sql.match(/(?:event_id|attempt_id|incident_key|outbox_id) (?:text PRIMARY KEY|text NOT NULL) CHECK \([^\n]+/g)||[];
 assert.equal(idChecks.length,5);
 for(const line of idChecks)assert.ok(line.replace(/,\s*$/,'').endsWith(String.raw`{8,80},'invalid ID check: '+line);
});
)`),'invalid ID check: '+line);
});
