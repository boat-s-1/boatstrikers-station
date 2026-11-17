// Pure immutable in-memory event ledger projection; never persists or sends.
const OUTCOMES=new Set(['success','timeout','connection_error','permission_denied','invalid_result','policy_hold']);
const parse=s=>{if(typeof s!=='string'||!/^\d{4}-\d\d-\d\dT/.test(s)||!/(Z|[+-]\d\d:\d\d)$/.test(s)||!Number.isFinite(Date.parse(s)))throw Error('invalid timestamp');return Date.parse(s)};
const safeId=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{8,80}$/.test(s);
export function projectCronIncidentLedger(events,{referenceAt,maxEvents=1000}={}){
 const ref=parse(referenceAt);
 if(!Array.isArray(events)||events.length>maxEvents||!Number.isSafeInteger(maxEvents)||maxEvents<1)throw Error('invalid events');
 const ids=new Set(),attempts=new Map(),alerts=new Map(),projection=[];let previousTime=null;
 for(const event of events){
  if(!event||typeof event!=='object'||Array.isArray(event))throw Error('invalid event');
  const keys=Object.keys(event);
  if(keys.some(k=>!['event_id','attempt_id','kind','at','outcome','incident_key'].includes(k)))throw Error('unexpected event field');
  if(!safeId(event.event_id)||!safeId(event.attempt_id)||ids.has(event.event_id))throw Error('invalid or duplicate event id');
  const time=parse(event.at);if(time>ref)throw Error('future event');if(previousTime!==null&&time<previousTime)throw Error('out of order event');previousTime=time;
  if(!['attempt','alert_proposed','alert_delivered','alert_failed'].includes(event.kind))throw Error('invalid event kind');
  if(event.kind==='attempt'){
   if(!OUTCOMES.has(event.outcome)||event.incident_key!==undefined||attempts.has(event.attempt_id))throw Error('invalid attempt');
   attempts.set(event.attempt_id,{outcome:event.outcome,at:event.at});
  }else{
   if(!attempts.has(event.attempt_id)||!safeId(event.incident_key)||event.outcome!==undefined)throw Error('invalid alert reference');
   const attempt=attempts.get(event.attempt_id);
   if(attempt.outcome==='success'||time<parse(attempt.at))throw Error('alert without incident');
   const existing=alerts.get(event.incident_key);
   if(event.kind==='alert_proposed'){
    if(existing)throw Error('duplicate incident proposal');
    alerts.set(event.incident_key,{state:'proposed',at:event.at,attempt_id:event.attempt_id});
   }else{
    if(!existing||existing.state!=='proposed'||existing.attempt_id!==event.attempt_id||time<parse(existing.at))throw Error('invalid alert transition');
    existing.state=event.kind==='alert_delivered'?'delivered':'failed';
    existing.at=event.at;
   }
  }
  ids.add(event.event_id);projection.push({...event});
 }
 return {schema_version:1,events:projection,attempt_count:attempts.size,incident_count:alerts.size,
  delivered_alert_count:[...alerts.values()].filter(x=>x.state==='delivered').length,
  pending_alert_count:[...alerts.values()].filter(x=>x.state==='proposed').length,
  failed_alert_count:[...alerts.values()].filter(x=>x.state==='failed').length,
  persistence_verified:false,delivery_verified:false,automatic_retry_allowed:false};
}
