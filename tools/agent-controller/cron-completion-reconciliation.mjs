// Pure offline reconciliation of stage and log outcomes. No live actions.
const STAGE=new Set(['completed','skipped_deadline','failed','unknown']);
const LOG=new Set(['confirmed','failed','timeout','unknown']);
export function reconcileCronCompletion({stageOutcome,logOutcome,articleEvidence='unknown',deadlineExceeded=false}){
  if(!STAGE.has(stageOutcome))throw Error('invalid stage outcome');
  if(!LOG.has(logOutcome))throw Error('invalid log outcome');
  if(!['records_present','none_observed','unknown'].includes(articleEvidence))throw Error('invalid article evidence');
  if(typeof deadlineExceeded!=='boolean')throw Error('invalid deadline flag');
  const incomplete=stageOutcome!=='completed'||logOutcome!=='confirmed'||deadlineExceeded;
  const display=stageOutcome==='failed'||logOutcome==='failed'||logOutcome==='timeout'||deadlineExceeded?'一部問題あり':incomplete?'要確認':'記録上の完了';
  return {
    display,
    stage_outcome:stageOutcome,
    completion_log:logOutcome,
    deadline_exceeded:deadlineExceeded,
    article_evidence:articleEvidence,
    end_to_end_delivery_verified:false,
    no_side_effects_proven:false,
    automatic_retry_allowed:false,
    automatic_republish_allowed:false,
    operator_review_required:incomplete||articleEvidence==='unknown',
    health:'unknown'
  };
}
