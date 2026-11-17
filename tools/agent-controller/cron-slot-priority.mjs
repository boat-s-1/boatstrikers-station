// Offline-only prioritization of time-slot aggregates; never triggers operations.
export function prioritizeCronSlots(rows){
  if(!Array.isArray(rows)||rows.length===0)throw Error('slot aggregates required');
  const seen=new Set();
  return rows.map(row=>{
    if(!row||typeof row!=='object'||Array.isArray(row)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.jst_slot)||seen.has(row.jst_slot))throw Error('invalid slot');
    seen.add(row.jst_slot);
    for(const key of ['total_runs','running_runs','partial_runs','missing_completion','no_article_windows','article_matches']){
      if(!Number.isSafeInteger(row[key])||row[key]<0)throw Error('invalid '+key);
    }
    if(row.running_runs+row.partial_runs>row.total_runs||row.missing_completion>row.total_runs||row.no_article_windows>row.total_runs)throw Error('inconsistent slot counts');
    return {
      slot_jst:row.jst_slot,
      total_runs:row.total_runs,
      missing_completion:row.missing_completion,
      partial_runs:row.partial_runs,
      no_article_windows:row.no_article_windows,
      temporal_article_matches:row.article_matches,
      review_score:row.missing_completion*3+row.partial_runs*2+row.no_article_windows,
      priority_reason:row.missing_completion>row.partial_runs?'completion_logging_review':'partial_failure_review',
      pipeline_health:'unknown',
      automatic_retry:false
    };
  }).sort((a,b)=>b.review_score-a.review_score||a.slot_jst.localeCompare(b.slot_jst));
}
