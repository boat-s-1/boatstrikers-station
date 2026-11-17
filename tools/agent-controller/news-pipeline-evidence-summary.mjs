import {assessCronReplaySafety} from './cron-replay-safety.mjs';
import {reconcileRunArticleWindow} from './cron-article-window-reconciliation.mjs';
import {classifyNewsInsertOutcome} from './news-insert-outcome.mjs';
// Pure offline presentation aggregator. Never asserts end-to-end production health.
export function summarizeNewsPipelineEvidence({runStatus,articleCount,markedPublishedCount,attemptedInsertCount,insertedCount=null,insertErrorCode=null}){
  const replay=assessCronReplaySafety({runStatus,publicationEvidence:articleCount>0?'records_present':'none_observed'});
  const window=reconcileRunArticleWindow({runStatus,articleCount,markedPublishedCount});
  const insert=classifyNewsInsertOutcome({attemptedCount:attemptedInsertCount,insertedCount,errorCode:insertErrorCode});
  let display='要確認';
  if(runStatus==='partial'||insert.assessment==='unique_conflict_review'||insert.assessment==='insert_error_review'||insert.assessment==='partial_count_review')display='一部問題あり';
  else if(runStatus==='success'&&insert.assessment==='insert_count_reported')display='記録上の成功';
  return {
    display,
    pipeline_health:'未確認',
    run_status:runStatus,
    article_evidence:window.evidence_kind,
    article_attribution:window.attribution,
    insert_assessment:insert.assessment,
    completion_evidence:replay.completion_evidence,
    automatic_replay_allowed:false,
    automatic_republish_allowed:false,
    action:'手動確認'
  };
}
