// Offline decision aid; never performs a retry or database mutation.
export function assessGeneralNewsReplaySafety({priorRun,sourceKeyUniquenessVerified=false,publicationIdempotencyVerified=false,operatorApproved=false}={}){
 const reasons=[];
 if(!priorRun||typeof priorRun!=='object'||!['success','partial','error','running'].includes(priorRun.status))reasons.push('unknown_prior_run');
 if(priorRun?.status==='running')reasons.push('completion_unverified');
 if(priorRun?.status==='partial')reasons.push('partial_side_effects_possible');
 if(priorRun?.status==='success')reasons.push('already_reported_success');
 if(priorRun?.status==='error')reasons.push('failed_run_may_have_committed');
 if(!sourceKeyUniquenessVerified)reasons.push('source_key_uniqueness_unverified');
 if(!publicationIdempotencyVerified)reasons.push('publication_idempotency_unverified');
 if(!operatorApproved)reasons.push('operator_approval_missing');
 // Even verified evidence must be evaluated by an independently authorized runner.
 return Object.freeze({decision:'HOLD',reasons,automaticReplayAllowed:false,productionWriteAllowed:false,notifyAllowed:false});
}
