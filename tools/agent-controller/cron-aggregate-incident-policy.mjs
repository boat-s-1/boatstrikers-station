// Offline-only incident ledger and notification proposal. No network, DB writes or sends.
const OUTCOMES=new Set(['success','timeout','connection_error','permission_denied','invalid_result','policy_hold']);
const parse=(s,label)=>{if(typeof s!=='string'||!/^\d{4}-\d\d-\d\dT/.test(s)||!/(Z|[+-]\d\d:\d\d)$/.test(s)||!Number.isFinite(Date.parse(s)))throw Error('invalid '+label);return Date.parse(s)};
export function evaluateCronAggregateIncident({attemptAt,outcome,previousAlertAt=null,referenceAt=attemptAt,alertCooldownMs=60*60*1000}){
  const attempt=parse(attemptAt,'attemptAt'),reference=parse(referenceAt,'referenceAt');
  if(!OUTCOMES.has(outcome))throw Error('invalid outcome');
  if(!Number.isSafeInteger(alertCooldownMs)||alertCooldownMs<60*60*1000)throw Error('invalid alertCooldownMs');
  if(attempt>reference)throw Error('attempt in future');
  let lastAlert=null;
  if(previousAlertAt!==null){lastAlert=parse(previousAlertAt,'previousAlertAt');if(lastAlert>reference)throw Error('alert in future')}
  const incident=outcome!=='success';
  const cooldownActive=lastAlert!==null&&reference-lastAlert<alertCooldownMs;
  return {
    schema_version:1,attempt_at:attemptAt,outcome,
    record:{kind:'aggregate_fetch_attempt',attempt_at:attemptAt,outcome,contains_secrets:false},
    alert_proposal:incident&&!cooldownActive?'operator_review_required':'none',
    alert_reason:incident?outcome:null,
    alert_suppressed_by_cooldown:incident&&cooldownActive,
    actual_record_persisted:false,actual_alert_sent:false,
    automatic_retry_allowed:false,automatic_republish_allowed:false,
    provider_api_accessed:false,production_mutation_performed:false
  };
}
