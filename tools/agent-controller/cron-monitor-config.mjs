// Strict configuration normalization for a proposed monitor. Never reads env or secrets.
const CHANNELS=new Set(['disabled','discord','email']);
export function validateCronMonitorConfig(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('invalid config');
 const allowed=new Set(['enabled','intervalMinutes','queryTimeoutMs','maxRows','alertChannel','dailyBudgetUsd','readOnlyRoleVerified','durableLedgerVerified','atomicDedupeVerified','deliveryReceiptVerified','productionApprovalVerified','killSwitchVerified']);
 if(Object.keys(input).some(k=>!allowed.has(k)))throw Error('unexpected config field');
 const {enabled=false,intervalMinutes=60,queryTimeoutMs=5000,maxRows=1,alertChannel='disabled',dailyBudgetUsd=0,readOnlyRoleVerified=false,durableLedgerVerified=false,atomicDedupeVerified=false,deliveryReceiptVerified=false,productionApprovalVerified=false,killSwitchVerified=false}=input;
 if(typeof enabled!=='boolean'||!Number.isSafeInteger(intervalMinutes)||intervalMinutes<60||intervalMinutes>1440||!Number.isSafeInteger(queryTimeoutMs)||queryTimeoutMs<100||queryTimeoutMs>5000||maxRows!==1||!CHANNELS.has(alertChannel)||typeof dailyBudgetUsd!=='number'||!Number.isFinite(dailyBudgetUsd)||dailyBudgetUsd<0||dailyBudgetUsd>5)throw Error('invalid config values');
 const gates={readOnlyRoleVerified,durableLedgerVerified,atomicDedupeVerified,deliveryReceiptVerified,productionApprovalVerified,killSwitchVerified};
 if(Object.values(gates).some(v=>typeof v!=='boolean'))throw Error('invalid gate value');
 const missing=Object.entries(gates).filter(([,v])=>!v).map(([k])=>k);
 if(alertChannel==='disabled')missing.push('alertChannel');
 if(dailyBudgetUsd===0)missing.push('dailyBudgetUsd');
 return {schema_version:1,requested_enabled:enabled,interval_minutes:intervalMinutes,query_timeout_ms:queryTimeoutMs,max_rows:1,alert_channel:alertChannel,daily_budget_usd:dailyBudgetUsd,
  readiness:missing.length?'hold':'eligible_for_separate_operator_review',missing_gates:missing,
  effective_enabled:false,credentials_verified_by_module:false,production_changes_performed:false,automatic_retry_allowed:false};
}
