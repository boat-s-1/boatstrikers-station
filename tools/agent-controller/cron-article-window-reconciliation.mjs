// Pure offline report from aggregate observations; no database access or attribution.
export function reconcileRunArticleWindow({runStatus,articleCount,markedPublishedCount}){
  if(!['running','partial','success','error'].includes(runStatus))throw Error('invalid run status');
  if(!Number.isSafeInteger(articleCount)||articleCount<0)throw Error('invalid article count');
  if(!Number.isSafeInteger(markedPublishedCount)||markedPublishedCount<0||markedPublishedCount>articleCount)throw Error('invalid published count');
  return {
    run_status:runStatus,
    article_count_in_window:articleCount,
    marked_published_in_window:markedPublishedCount,
    evidence_kind:'temporal_only',
    attribution:'unproven',
    completion:'running'===runStatus?'unknown':'status_reported',
    no_side_effects_proven:false,
    automatic_replay_allowed:false,
    automatic_republish_allowed:false
  };
}
