import {createHmac} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {verifySyntheticReceiptEnvelope} from './cron-monitor-synthetic-receipt-verifier.mjs';
if(process.env.PGHOST!=='127.0.0.1'||process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='agent_controller_ci'||process.env.PGUSER!=='agent_ci') throw new Error('Refusing non-CI PostgreSQL target');
const sql=q=>execFileSync('psql',['-X','-v','ON_ERROR_STOP=1','-qAt','-c',q],{encoding:'utf8',timeout:10000}).trim();
const incident='ci_signed_receipt_01';
const secret='synthetic-ci-signing-secret-not-for-production-0123456789';
const now=2000000;
sql(`INSERT INTO agent_monitor.incident_reservations VALUES ('${incident}','ci_signed_attempt','reserved');
INSERT INTO agent_monitor.notification_outbox VALUES ('ci_signed_outbox','${incident}','pending_review');
UPDATE agent_monitor.notification_outbox SET delivery_state='approved' WHERE incident_key='${incident}';
UPDATE agent_monitor.notification_outbox SET delivery_state='in_flight' WHERE incident_key='${incident}';`);
const payload=JSON.stringify({incidentKey:incident,receiptId:'ci_signed_receipt_id',status:'delivered',issuedAt:now-1000});
const signature='sha256='+createHmac('sha256',secret).update(payload).digest('hex');
const invalid=verifySyntheticReceiptEnvelope({payload,signature:'sha256='+'0'.repeat(64),secret,expectedIncidentKey:incident,now});
assert.equal(invalid.decision,'hold');
assert.equal(sql(`SELECT delivery_state FROM agent_monitor.notification_outbox WHERE incident_key='${incident}'`),'in_flight');
assert.equal(sql(`SELECT count(*) FROM agent_monitor.delivery_receipts_ci WHERE incident_key='${incident}'`),'0');
const verified=verifySyntheticReceiptEnvelope({payload,signature,secret,expectedIncidentKey:incident,now});
assert.equal(verified.decision,'eligible_for_offline_receipt_review');
assert.equal(verified.writeAllowed,false);
assert.equal(verified.sendAllowed,false);
// CI harness explicitly authorizes only synthetic local fixture persistence, never the verifier itself.
assert.equal(verified.incidentKey,incident);
assert.equal(verified.receiptId,'ci_signed_receipt_id');
sql(`BEGIN;
INSERT INTO agent_monitor.delivery_receipts_ci VALUES ('${incident}','ci_signed_receipt_id') ON CONFLICT DO NOTHING;
UPDATE agent_monitor.notification_outbox SET delivery_state='delivered'
 WHERE incident_key='${incident}' AND delivery_state='in_flight';
COMMIT;`);
assert.equal(sql(`SELECT delivery_state FROM agent_monitor.notification_outbox WHERE incident_key='${incident}'`),'delivered');
sql(`BEGIN;
INSERT INTO agent_monitor.delivery_receipts_ci VALUES ('${incident}','ci_signed_receipt_id') ON CONFLICT DO NOTHING;
UPDATE agent_monitor.notification_outbox SET delivery_state='delivered'
 WHERE incident_key='${incident}' AND delivery_state='in_flight';
COMMIT;`);
assert.equal(sql(`SELECT count(*) FROM agent_monitor.delivery_receipts_ci WHERE incident_key='${incident}'`),'1');
console.log('PASS: invalid synthetic signature blocked; signed fixture persisted once with delivered transition');
