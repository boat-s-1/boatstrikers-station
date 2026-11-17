import {buildCronDiagnosticReport} from './cron-diagnostic-report.mjs';
import {validateDiagnosticEvidence} from './diagnostic-evidence-provenance.mjs';
// Evidence-gated offline report. Never treats supplied metadata as authenticated provenance.
export function buildEvidenceGatedCronReport({diagnosticInput,evidenceInput}){
  if(!diagnosticInput||typeof diagnosticInput!=='object'||Array.isArray(diagnosticInput))throw Error('invalid diagnostic input');
  if(!evidenceInput||typeof evidenceInput!=='object'||Array.isArray(evidenceInput))throw Error('invalid evidence input');
  const evidence=validateDiagnosticEvidence(evidenceInput);
  const diagnostic=buildCronDiagnosticReport(diagnosticInput);
  const gates=[];
  if(evidence.synthetic)gates.push('synthetic_test_only');
  if(evidence.freshness==='stale')gates.push('stale_observation');
  if(evidence.environment!=='production')gates.push('not_production_environment');
  if(!evidence.independently_verified)gates.push('unverified_provenance');
  const display=evidence.synthetic?'テストデータ':evidence.freshness==='stale'?'過去の観測':diagnostic.display;
  return {
    schema_version:1,display,diagnostic,evidence,evidence_gates:gates,
    production_current_status_verified:false,
    automatic_retry_allowed:false,automatic_republish_allowed:false,
    operator_review_required:true
  };
}
