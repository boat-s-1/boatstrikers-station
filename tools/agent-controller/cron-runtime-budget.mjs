// Offline evidence-only assessment. No production timer or retry changes.
export function assessCronRuntimeBudget({maxDurationMs,completedDurationMs=null,finishedAtRecorded=false}){
  if(!Number.isSafeInteger(maxDurationMs)||maxDurationMs<=0)throw Error('invalid max duration');
  if(typeof finishedAtRecorded!=='boolean')throw Error('invalid finished flag');
  if(completedDurationMs===null){
    if(finishedAtRecorded)throw Error('inconsistent completion evidence');
    return {assessment:'missing_completion_evidence',runtime_health:'unknown',automatic_retry:false};
  }
  if(!Number.isSafeInteger(completedDurationMs)||completedDurationMs<0||!finishedAtRecorded)throw Error('invalid duration evidence');
  const remainingMs=maxDurationMs-completedDurationMs;
  return {assessment:remainingMs<=5000?'limited_headroom':'duration_recorded',remaining_ms:remainingMs,runtime_health:'unknown',automatic_retry:false};
}
