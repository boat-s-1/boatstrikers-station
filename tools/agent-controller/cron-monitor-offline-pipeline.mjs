import {assessCronMonitorSnapshot} from './cron-monitor-snapshot-gate.mjs';
import {planOutboxWorkerCycle} from './cron-monitor-worker-cycle-planner.mjs';

// Offline end-to-end decision pipeline. No network, database, credentials or notifications.
export function planCronMonitorPipeline({snapshot,referenceAt,incidentKey,steps=[]}={}){
 const hold=(stage,reason)=>Object.freeze({decision:'hold',stage,reason,writeAllowed:false,sendAllowed:false});
 const gate=assessCronMonitorSnapshot({snapshot,referenceAt});
 if(gate.decision!=='eligible_for_offline_review') return hold('snapshot',gate.reason);
 if(typeof incidentKey!=='string'||!/^[-_a-zA-Z0-9:]{1,160}$/.test(incidentKey)) return hold('incident','invalid_incident_key');
 if(!snapshot.records.length) return hold('incident','no_records_to_review');
 if(!snapshot.records.some(r=>r.status!=='completed')) return hold('incident','no_abnormal_record');
 const worker=planOutboxWorkerCycle({steps});
 if(worker.decision!=='proposal_only') return Object.freeze({decision:'hold',stage:'outbox',reason:'worker_transition_blocked',state:worker.state,writeAllowed:false,sendAllowed:false});
 return Object.freeze({decision:'offline_review_only',stage:'complete',incidentKey,recordCount:gate.recordCount,proposedState:worker.state,writeAllowed:false,sendAllowed:false});
}
