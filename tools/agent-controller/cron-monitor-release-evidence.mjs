import {assessCronMonitorGoNoGo} from './cron-monitor-go-no-go.mjs';
import {assessCronMonitorEvidenceManifest} from './cron-monitor-evidence-manifest.mjs';
// Offline consistency review: URLs and flags are untrusted claims, not independent attestations.
const DEPENDENCIES=Object.freeze({
 isolatedProjectVerified:'schema_execution',
 leastPrivilegeVerified:'row_level_security',
 atomicRacePassed:'parallel_race',
 crashRecoveryPassed:'crash_recovery',
 receiptSandboxPassed:'delivery_receipt',
 queryLatencyMeasured:'query_latency',
 rollbackRehearsed:'rollback'
});
export function assessCronMonitorReleaseEvidence({claims={},manifest={}}={}){
 const gate=assessCronMonitorGoNoGo(claims);
 const evidence=assessCronMonitorEvidenceManifest(manifest);
 const mismatch=Object.entries(DEPENDENCIES).filter(([claim,key])=>
  claims[claim]===true && !(manifest.evidence?.[key]?.status==='verified' &&
   (manifest.evidence[key].environment==='isolated'||manifest.evidence[key].environment==='independent'))
 ).map(([claim,key])=>({claim,missing_evidence:key}));
 return {schema_version:1,decision:'hold',gate_missing:gate.missing,
  evidence_missing:evidence.missing,evidence_unverified:evidence.unverified,
  unsupported_claims:mismatch,independently_authenticated:false,
  production_deployment_allowed:false,notification_delivery_allowed:false,
  next_step:mismatch.length?'resolve_unsupported_claims':evidence.missing.length||evidence.unverified.length?'collect_evidence':'independent_review_and_explicit_approval'};
}
