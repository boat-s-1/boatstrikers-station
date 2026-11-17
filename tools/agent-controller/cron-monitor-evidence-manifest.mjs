// Offline-only evidence manifest. Does not independently verify evidence authenticity.
const REQUIRED=['schema_execution','sequential_uniqueness','row_level_security','parallel_race','crash_recovery','delivery_receipt','query_latency','retention','rollback','independent_security_review'];
const STATUSES=['verified','not_tested','failed'];
export function assessCronMonitorEvidenceManifest(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['evidence'].includes(k)))throw Error('invalid manifest');
 const evidence=input.evidence??{};
 if(!evidence||typeof evidence!=='object'||Array.isArray(evidence)||Object.keys(evidence).some(k=>!REQUIRED.includes(k)))throw Error('invalid evidence entries');
 const missing=[],unverified=[],claimed=[];
 for(const key of REQUIRED){
  const item=evidence[key];
  if(item===undefined){missing.push(key);continue}
  if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(k=>!['status','reference','environment'].includes(k)))throw Error('invalid evidence item');
  if(!STATUSES.includes(item.status))throw Error('invalid evidence status');
  if(typeof item.reference!=='string'||item.reference.length<8||item.reference.length>512||!/^https:\/\/github\.com\/boat-s-1\/boatstrikers-station\/(?:actions\/runs\/\d+|pull\/\d+|blob\/[^\s]+)$/.test(item.reference))throw Error('invalid evidence reference');
  if(!['offline','isolated','independent'].includes(item.environment))throw Error('invalid evidence environment');
  if(item.status==='verified')claimed.push(key);else unverified.push(key);
 }
 return {schema_version:1,decision:'hold',missing,unverified,claimed_verified:claimed,
  independently_authenticated:false,production_deployment_allowed:false,notification_delivery_allowed:false,
  next_step:missing.length||unverified.length?'collect_and_independently_verify_evidence':'separate_explicit_release_approval'};
}
export const CRON_MONITOR_EVIDENCE_KEYS=Object.freeze([...REQUIRED]);
