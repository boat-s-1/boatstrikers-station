import {mkdirSync,writeFileSync} from 'node:fs';
import {planCronMonitorPipeline} from './cron-monitor-offline-pipeline.mjs';

// Fixed synthetic fixtures only. No CLI input, environment credentials or network access.
const referenceAt=2000000;
const base={capturedAt:1999000,source:'cron_aggregate_readonly',readonlyVerified:true,queryFingerprint:'a'.repeat(64),records:[{attemptId:'synthetic_01',status:'unfinished',startedAt:1998000}]};
const cases=[
 {name:'abnormal_requires_review',snapshot:base,steps:[],expected:'offline_review_only'},
 {name:'stale_snapshot_blocked',snapshot:{...base,capturedAt:1},steps:[],expected:'hold'},
 {name:'unverified_source_blocked',snapshot:{...base,readonlyVerified:false},steps:[],expected:'hold'},
 {name:'unapproved_delivery_blocked',snapshot:base,steps:[{event:'approve'}],expected:'hold'},
 {name:'synthetic_receipt_still_offline',snapshot:base,steps:[{event:'approve',operatorReviewed:true},{event:'start_delivery'},{event:'receipt_confirmed',authenticatedReceipt:true}],expected:'offline_review_only'},
 {name:'worker_crash_replay_blocked',snapshot:base,steps:[{event:'approve',operatorReviewed:true},{event:'start_delivery'},{event:'worker_lost'},{event:'retry_requested',operatorReviewed:true}],expected:'hold'}
];
const results=cases.map(({name,snapshot,steps,expected})=>{
 const r=planCronMonitorPipeline({snapshot,referenceAt,incidentKey:'synthetic:cron:01',steps});
 if(r.decision!==expected||r.writeAllowed!==false||r.sendAllowed!==false) throw new Error('offline safety regression: '+name);
 return {name,decision:r.decision,stage:r.stage,reason:r.reason??null,writeAllowed:r.writeAllowed,sendAllowed:r.sendAllowed};
});
mkdirSync('offline-report',{recursive:true});
writeFileSync('offline-report/pipeline-validation.json',JSON.stringify({kind:'synthetic_offline_only',productionEvidence:false,caseCount:results.length,results},null,2)+'\n',{flag:'w'});
console.log('PASS: '+results.length+' synthetic pipeline cases, no writes or sends');
