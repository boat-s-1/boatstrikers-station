// Pure offline request-vs-stage timing reconciliation. No live clocks or service calls.
export function reconcileRequestTiming({requestElapsedMs=null,knownStageDurationMs,unknownStageCount=0,maxDurationMs=60000,warningHeadroomMs=8000}){
  for(const [key,value] of Object.entries({knownStageDurationMs,unknownStageCount,maxDurationMs,warningHeadroomMs})){
    if(!Number.isSafeInteger(value)||value<0)throw Error('invalid '+key);
  }
  if(maxDurationMs===0||warningHeadroomMs>=maxDurationMs)throw Error('invalid runtime budget');
  if(requestElapsedMs!==null&&(!Number.isSafeInteger(requestElapsedMs)||requestElapsedMs<0))throw Error('invalid request elapsed');
  if(requestElapsedMs!==null&&knownStageDurationMs>requestElapsedMs)throw Error('inconsistent timing evidence');
  const overheadMs=requestElapsedMs===null?null:requestElapsedMs-knownStageDurationMs;
  let assessment='missing_request_timing';
  if(requestElapsedMs!==null){
    if(requestElapsedMs>=maxDurationMs)assessment='reported_limit_reached';
    else if(requestElapsedMs>=maxDurationMs-warningHeadroomMs)assessment='limited_headroom';
    else if(unknownStageCount>0)assessment='incomplete_stage_coverage';
    else assessment='reported_within_budget';
  }
  return {
    assessment,
    request_elapsed_ms:requestElapsedMs,
    known_stage_duration_ms:knownStageDurationMs,
    unaccounted_elapsed_ms:overheadMs,
    unknown_stage_count:unknownStageCount,
    remaining_to_limit_ms:requestElapsedMs===null?null:Math.max(0,maxDurationMs-requestElapsedMs),
    actual_timeout_proven:false,
    end_to_end_health:'unknown',
    automatic_retry:false
  };
}
