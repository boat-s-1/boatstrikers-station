// Release authorization is deliberately not inferred from passing synthetic CI.
export const REQUIRED_LIVE_EVIDENCE=Object.freeze([
 'source_authentication','readonly_provenance','cron_semantics',
 'worker_atomicity','lease_fencing','operator_authentication',
 'provider_receipt_authentication','provider_idempotency',
 'unknown_delivery_reconciliation','production_schema_rls',
 'independent_security_review','explicit_production_approval',
]);
export function assessLiveReleaseGate({evidence}={}){
 const missing=[];
 for(const key of REQUIRED_LIVE_EVIDENCE){
  const entry=evidence?.[key];
  // A self-reported boolean, CI success or synthetic test is never sufficient.
  if(!entry||entry.kind!=='independently_verified_live'||entry.verified!==true||
     typeof entry.reference!=='string'||!/^https:\/\//.test(entry.reference)||
     typeof entry.verifiedBy!=='string'||entry.verifiedBy.length<3) missing.push(key);
 }
 // This module has no authority to grant production release, even when all evidence is present.
 return Object.freeze({decision:'HOLD',reason:missing.length?'missing_live_evidence':'manual_release_authorization_required',
  missingEvidence:Object.freeze(missing),deployAllowed:false,sendAllowed:false,productionWriteAllowed:false});
}
