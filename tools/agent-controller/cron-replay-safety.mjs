// Offline-only replay safety gate: never infer a retry is safe from missing completion.
const STATES=new Set(['running','partial','success','error','not_found']);
export function assessCronReplaySafety({runStatus,publicationEvidence='unknown',idempotencyVerified=false}){
  if(!STATES.has(runStatus))throw Error('invalid run status');
  if(!['records_present','none_observed','unknown'].includes(publicationEvidence))throw Error('invalid publication evidence');
  if(typeof idempotencyVerified!=='boolean')throw Error('invalid idempotency evidence');
  const incomplete=runStatus==='running'||runStatus==='not_found';
  const reason=incomplete?'completion_unknown':publicationEvidence==='records_present'?'publication_side_effects_possible':'manual_review_required';
  return {
    reason,
    completion_evidence:incomplete?'missing':'reported_only',
    publication_evidence:publicationEvidence,
    idempotency_verified:idempotencyVerified,
    automatic_replay_allowed:false,
    automatic_republish_allowed:false,
    operator_review_required:true
  };
}
