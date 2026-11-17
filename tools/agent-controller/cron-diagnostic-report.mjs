import {reconcileCronCompletion} from './cron-completion-reconciliation.mjs';
import {reconcileRequestTiming} from './cron-request-timing-reconciliation.mjs';
import {normalizeCronStageTelemetry} from './cron-stage-telemetry-schema.mjs';
// Offline-only combined diagnostic; evidence is caller-supplied and not independently verified.
export function buildCronDiagnosticReport({runKey,stageObservations,stageOutcome,logOutcome,articleEvidence='unknown',requestElapsedMs=null,deadlineExceeded=false,maxDurationMs=60000}){
  const telemetry=normalizeCronStageTelemetry({runKey,stages:stageObservations,maxDurationMs});
  const timing=reconcileRequestTiming({
    requestElapsedMs,knownStageDurationMs:telemetry.known_stage_duration_ms,
    unknownStageCount:telemetry.unknown_duration_stage_count,maxDurationMs
  });
  const completion=reconcileCronCompletion({stageOutcome,logOutcome,articleEvidence,deadlineExceeded});
  const issues=[];
  if(logOutcome==='failed'||logOutcome==='timeout')issues.push('completion_log_problem');
  if(stageOutcome==='failed')issues.push('stage_failure');
  if(deadlineExceeded||timing.assessment==='reported_limit_reached')issues.push('deadline_review');
  if(timing.assessment==='limited_headroom')issues.push('limited_headroom');
  if(timing.assessment==='missing_request_timing'||timing.assessment==='incomplete_stage_coverage')issues.push('timing_evidence_incomplete');
  if(stageOutcome==='unknown'||stageOutcome==='skipped_deadline'||logOutcome==='unknown')issues.push('completion_unknown');
  const display=issues.some(x=>['completion_log_problem','stage_failure','deadline_review'].includes(x))?'一部問題あり':
    issues.length?'要確認':completion.display;
  return {
    schema_version:1,run_key:runKey,display,priority_issues:issues,
    telemetry,timing,completion,
    evidence_provenance:'caller_supplied',
    actual_delivery_verified:false,automatic_retry_allowed:false,
    automatic_republish_allowed:false,production_health:'unknown'
  };
}
