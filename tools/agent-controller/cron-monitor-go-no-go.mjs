// Offline-only acceptance checklist; flags are operator claims, not independently attested.
const FIELDS=['isolatedProjectVerified','billingCeilingVerified','testWriteAuthorization','leastPrivilegeVerified','atomicRacePassed','crashRecoveryPassed','receiptSandboxPassed','queryLatencyMeasured','retentionApproved','rollbackRehearsed','productionChangeApproved'];
export function assessCronMonitorGoNoGo(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!FIELDS.includes(k)))throw Error('unexpected approval field');
 const missing=[];
 for(const field of FIELDS){if(input[field]!==undefined&&typeof input[field]!=='boolean')throw Error('invalid approval field');if(input[field]!==true)missing.push(field)}
 return {schema_version:1,decision:'hold',missing,all_claimed:missing.length===0,
  next_step:missing.length?'complete_isolated_validation':'independent_operator_and_security_review',
  operator_claims_only:true,production_approval_independently_verified:false,
  actual_production_deployment:false,actual_notification_sent:false,automatic_replay_allowed:false};
}
