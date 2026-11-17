import test from 'node:test';import assert from 'node:assert/strict';
import {assessCronAggregateFetchPolicy} from './cron-aggregate-fetch-policy.mjs';
import {evaluateCronAggregateIncident} from './cron-aggregate-incident-policy.mjs';
import {decideCronAlertReservation} from './cron-alert-dedupe.mjs';
import {projectCronIncidentLedger} from './cron-incident-ledger.mjs';
import {assessCronIncidentRecovery} from './cron-incident-recovery.mjs';
import {buildCronAggregateTriage} from './cron-aggregate-triage.mjs';
const at='2026-11-17T09:00:00Z',incidentKey='incident_01';
test('unapproved fetch remains hold and never fetches',()=>{
 const p=assessCronAggregateFetchPolicy({now:at});
 assert.equal(p.admission_recommendation,'hold');assert.equal(p.actual_fetch_executed,false);
});
test('policy hold proposes review but does not send',()=>{
 const i=evaluateCronAggregateIncident({attemptAt:at,outcome:'policy_hold'});
 assert.equal(i.alert_proposal,'operator_review_required');assert.equal(i.actual_alert_sent,false);
});
test('dedupe reserves only as proposal',()=>{
 const d=decideCronAlertReservation({incidentKey,now:at});
 assert.equal(d.decision,'propose_atomic_reservation');assert.equal(d.actual_reservation_created,false);
});
test('replayed duplicate event rejected',()=>{
 const e={event_id:'event_0001',attempt_id:'attempt_01',kind:'attempt',at,outcome:'timeout'};
 assert.throws(()=>projectCronIncidentLedger([e,e],{referenceAt:at}),/duplicate event/);
});
test('notification record does not prove external delivery',()=>{
 const e={event_id:'event_0001',attempt_id:'attempt_01',kind:'attempt',at,outcome:'timeout'};
 const p={event_id:'event_0002',attempt_id:'attempt_01',kind:'alert_proposed',at,incident_key:incidentKey};
 const d={event_id:'event_0003',attempt_id:'attempt_01',kind:'alert_delivered',at,incident_key:incidentKey};
 assert.equal(projectCronIncidentLedger([e,p,d],{referenceAt:at}).delivery_verified,false);
});
test('recovery requires operator review and cannot republish',()=>{
 const observations=[9,10,11].map(h=>({at:`2026-11-17T${String(h).padStart(2,'0')}:00:00Z`,healthy:true,authenticated:true}));
 const r=assessCronIncidentRecovery({observations,referenceAt:'2026-11-17T11:05:00Z'});
 assert.equal(r.recovery_proposal,'manual_close_review');assert.equal(r.automatic_republish_allowed,false);
});
test('historical aggregate cannot be current production proof',()=>{
 const aggregateInput={observed_at:'2026-11-17T08:00:00Z',window_start:'2026-10-27T08:00:00Z',window_end:'2026-11-17T07:57:00Z',runs_total:63,running_without_finish:34,partial_runs:29,windows_with_articles:58,temporal_article_matches:428};
 const evidenceInput={source:'readonly_supabase_aggregate',environment:'production',observedAt:aggregateInput.observed_at,referenceAt:'2026-11-17T09:00:00Z'};
 const r=buildCronAggregateTriage({aggregateInput,evidenceInput});
 assert.equal(r.review_priority,'historical_or_test_only');assert.equal(r.live_health_verified,false);
});
