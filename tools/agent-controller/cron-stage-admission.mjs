// Pure offline prototype. Does not schedule tasks, cancel requests, or write logs.
export function decideStageAdmission({elapsedMs,limitMs=60000,reserveMs=8000,stageBudgetMs}){
  for(const [name,value] of Object.entries({elapsedMs,limitMs,reserveMs,stageBudgetMs})){
    if(!Number.isSafeInteger(value)||value<0)throw Error('invalid '+name);
  }
  if(limitMs===0||reserveMs>=limitMs)throw Error('invalid runtime budget');
  const remainingMs=Math.max(0,limitMs-elapsedMs);
  const availableStageMs=Math.max(0,remainingMs-reserveMs);
  const allowed=stageBudgetMs>0&&stageBudgetMs<=availableStageMs;
  return {
    decision:allowed?'admit':'skip_for_deadline',
    remaining_ms:remainingMs,
    stage_budget_available_ms:availableStageMs,
    completion_reserve_ms:reserveMs,
    must_record_skip:!allowed,
    runtime_health:'unknown',
    automatic_retry:false
  };
}
