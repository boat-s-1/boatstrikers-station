import test from 'node:test';import assert from 'node:assert/strict';
import {assessCronAggregateFetchPolicy} from './cron-aggregate-fetch-policy.mjs';
import {evaluateCronAggregateIncident} from './cron-aggregate-incident-policy.mjs';
import {decideCronAlertReservation} from './cron-alert-dedupe.mjs';
import {buildCronNotificationOutboxProposal} from './cron-monitor-notification-outbox.mjs';
import {assessCronMonitorKillSwitch} from './cron-monitor-kill-switch.mjs';
const at='2026-11-17T09:00:00Z';
for(const outcome of ['timeout','connection_error','permission_denied','invalid_result','policy_hold']){
 test('incident '+outcome+' cannot send or retry',()=>{
  const incident=evaluateCronAggregateIncident({attemptAt:at,outcome});
  assert.equal(incident.actual_alert_sent,false);
  assert.equal(incident.automatic_retry_allowed,false);
  const outbox=buildCronNotificationOutboxProposal({incidentKey:'incident_01',attemptId:'attempt_01',reason:outcome});
  assert.equal(outbox.readiness,'hold');assert.equal(outbox.notification_sent,false);
 });
}
test('operator kill switch remains hold',()=>assert.equal(assessCronMonitorKillSwitch().decision,'hold'));
test('stale evidence holds',()=>assert.ok(assessCronAggregateFetchPolicy({now:at,observationAt:'2026-11-17T08:00:00Z'}).reasons.includes('observation_stale')));
test('duplicate reservation cannot be proposed',()=>assert.equal(decideCronAlertReservation({incidentKey:'incident_01',now:at,existing:{incident_key:'incident_01',state:'reserved',at:'2026-11-17T08:00:00Z'}}).decision,'hold'));
test('recent failure cannot bypass cooldown',()=>assert.equal(decideCronAlertReservation({incidentKey:'incident_01',now:at,existing:{incident_key:'incident_01',state:'failed',at:'2026-11-17T08:30:00Z'}}).decision,'hold'));
