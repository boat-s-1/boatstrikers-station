// Pure, offline-only admission policy. No scheduling, database calls, or network.
const DEFAULTS=Object.freeze({minIntervalMs:60*60*1000,maxObservationAgeMs:15*60*1000,maxQueryDurationMs:5000,maxRows:1});
const parseTime=(value,label)=>{if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT/.test(value)||!/(Z|[+-]\d\d:\d\d)$/.test(value)||!Number.isFinite(Date.parse(value)))throw Error('invalid '+label);return Date.parse(value)};
export function assessCronAggregateFetchPolicy({now,lastAttemptAt=null,observationAt=null,environment='unknown',readOnlyCredentialVerified=false,explicitProductionApproval=false,queryPlanReviewed=false,sqlFingerprintVerified=false,queryDurationLimitMs=DEFAULTS.maxQueryDurationMs,resultRowLimit=DEFAULTS.maxRows,minIntervalMs=DEFAULTS.minIntervalMs,maxObservationAgeMs=DEFAULTS.maxObservationAgeMs}){
  const nowMs=parseTime(now,'now');
  if(!['production','staging','synthetic','unknown'].includes(environment))throw Error('invalid environment');
  for(const [key,value] of Object.entries({queryDurationLimitMs,resultRowLimit,minIntervalMs,maxObservationAgeMs})){
    if(!Number.isSafeInteger(value)||value<0)throw Error('invalid '+key);
  }
  const reasons=[];
  if(environment!=='production')reasons.push('production_environment_unverified');
  if(!readOnlyCredentialVerified)reasons.push('read_only_credential_unverified');
  if(!explicitProductionApproval)reasons.push('production_approval_missing');
  if(!queryPlanReviewed)reasons.push('query_plan_unreviewed');
  if(!sqlFingerprintVerified)reasons.push('sql_fingerprint_unverified');
  if(queryDurationLimitMs>DEFAULTS.maxQueryDurationMs||queryDurationLimitMs===0)reasons.push('query_duration_limit_exceeded');
  if(resultRowLimit!==1)reasons.push('result_row_limit_invalid');
  if(minIntervalMs<DEFAULTS.minIntervalMs)reasons.push('interval_too_short');
  if(maxObservationAgeMs>DEFAULTS.maxObservationAgeMs)reasons.push('observation_age_limit_exceeded');
  if(lastAttemptAt!==null){
    const last=parseTime(lastAttemptAt,'lastAttemptAt');
    if(last>nowMs)reasons.push('last_attempt_in_future');
    else if(nowMs-last<minIntervalMs)reasons.push('minimum_interval_not_elapsed');
  }
  if(observationAt!==null){
    const observed=parseTime(observationAt,'observationAt');
    if(observed>nowMs)reasons.push('observation_in_future');
    else if(nowMs-observed>maxObservationAgeMs)reasons.push('observation_stale');
  }else reasons.push('observation_missing');
  return {
    schema_version:1,mode:'offline_policy_only',
    admission_recommendation:reasons.length===0?'eligible_for_separate_operator_review':'hold',
    reasons,
    actual_fetch_executed:false,production_approval_granted_by_this_policy:false,
    automatic_fetch_enabled:false,automatic_retry_allowed:false,automatic_republish_allowed:false
  };
}
