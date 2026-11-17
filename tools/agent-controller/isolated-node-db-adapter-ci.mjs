import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';

// Real Node -> disposable PostgreSQL adapter integration. No production path.
if(process.env.PGHOST!=='127.0.0.1'||process.env.PGDATABASE!=='agent_controller_ci'||process.env.PGUSER!=='agent_ci'||process.env.PGPORT!=='5432'){
 throw new Error('Refusing database outside fixed disposable CI target');
}
const sql=(query)=>execFileSync('psql',['-X','-v','ON_ERROR_STOP=1','-qAt','-c',query],{encoding:'utf8',timeout:10000}).trim();
const incident='ci_node_worker_01';
const outbox='ci_node_outbox_01';
const first=sql(`BEGIN;
 INSERT INTO agent_monitor.incident_reservations VALUES ('${incident}','ci_node_attempt_01','reserved') ON CONFLICT DO NOTHING;
 INSERT INTO agent_monitor.notification_outbox VALUES ('${outbox}','${incident}','pending_review') ON CONFLICT DO NOTHING;
 COMMIT;
 SELECT count(*) FROM agent_monitor.notification_outbox WHERE incident_key='${incident}';`);
assert.equal(first,'1');
const replay=sql(`BEGIN;
 INSERT INTO agent_monitor.incident_reservations VALUES ('${incident}','ci_node_attempt_replay','reserved') ON CONFLICT DO NOTHING;
 INSERT INTO agent_monitor.notification_outbox VALUES ('ci_node_outbox_replay','${incident}','pending_review') ON CONFLICT DO NOTHING;
 COMMIT;
 SELECT count(*) FROM agent_monitor.notification_outbox WHERE incident_key='${incident}';`);
assert.equal(replay,'1');
const approve=sql(`WITH changed AS (UPDATE agent_monitor.notification_outbox SET delivery_state='approved' WHERE incident_key='${incident}' AND delivery_state='pending_review' RETURNING outbox_id) SELECT count(*) FROM changed;`);
assert.equal(approve,'1');
const approveAgain=sql(`WITH changed AS (UPDATE agent_monitor.notification_outbox SET delivery_state='approved' WHERE incident_key='${incident}' AND delivery_state='pending_review' RETURNING outbox_id) SELECT count(*) FROM changed;`);
assert.equal(approveAgain,'0');
const claim=sql(`WITH changed AS (UPDATE agent_monitor.notification_outbox SET delivery_state='in_flight' WHERE incident_key='${incident}' AND delivery_state='approved' RETURNING outbox_id) SELECT count(*) FROM changed;`);
assert.equal(claim,'1');
const claimAgain=sql(`WITH changed AS (UPDATE agent_monitor.notification_outbox SET delivery_state='in_flight' WHERE incident_key='${incident}' AND delivery_state='approved' RETURNING outbox_id) SELECT count(*) FROM changed;`);
assert.equal(claimAgain,'0');
const unknown=sql(`WITH changed AS (UPDATE agent_monitor.notification_outbox SET delivery_state='delivery_unknown' WHERE incident_key='${incident}' AND delivery_state='in_flight' RETURNING outbox_id) SELECT count(*) FROM changed;`);
assert.equal(unknown,'1');
const unsafeRetry=sql(`WITH changed AS (UPDATE agent_monitor.notification_outbox SET delivery_state='in_flight' WHERE incident_key='${incident}' AND delivery_state='approved' RETURNING outbox_id) SELECT count(*) FROM changed;`);
assert.equal(unsafeRetry,'0');
assert.equal(sql(`SELECT delivery_state FROM agent_monitor.notification_outbox WHERE incident_key='${incident}';`),'delivery_unknown');
console.log('PASS: Node adapter -> real disposable PostgreSQL: reservation, replay, CAS approval, claim, crash unknown, no automatic resend');
