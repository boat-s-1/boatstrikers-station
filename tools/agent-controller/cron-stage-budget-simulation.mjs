// Pure offline sequential-stage simulation. Does not call network, DB or AI.
const STAGES=['collection','media','general','fallback','ai','finish_log'];
export function simulateCronStageBudget({durationsMs,maxDurationMs=60000,completionReserveMs=8000,fallbackNeeded=false,aiEnabled=true}){
  if(!durationsMs||typeof durationsMs!=='object'||Array.isArray(durationsMs)||Object.keys(durationsMs).some(k=>!STAGES.includes(k)))throw Error('invalid stage durations');
  for(const [k,v] of Object.entries(durationsMs))if(!Number.isSafeInteger(v)||v<0)throw Error('invalid stage duration '+k);
  if(!Number.isSafeInteger(maxDurationMs)||maxDurationMs<=0||!Number.isSafeInteger(completionReserveMs)||completionReserveMs<0||completionReserveMs>=maxDurationMs)throw Error('invalid runtime budget');
  if(typeof fallbackNeeded!=='boolean'||typeof aiEnabled!=='boolean')throw Error('invalid stage options');
  const order=['collection','media','general',...(fallbackNeeded?['fallback']:[]),...(aiEnabled?['ai']:[])];
  let elapsed=0;const stages=[];let stop=false;
  for(const stage of order){
    const duration=durationsMs[stage];
    if(duration===undefined)throw Error('missing stage duration '+stage);
    const admitted=!stop&&elapsed+duration<=maxDurationMs-completionReserveMs;
    stages.push({stage,decision:admitted?'admit':'skip_for_deadline',budget_ms:duration});
    if(admitted)elapsed+=duration;else stop=true;
  }
  const finishLogMs=durationsMs.finish_log;
  if(finishLogMs===undefined)throw Error('missing stage duration finish_log');
  const logFits=elapsed+finishLogMs<=maxDurationMs;
  return {stages,elapsed_before_log_ms:elapsed,finish_log_budget_ms:finishLogMs,finish_log_fits_simulated:logFits,remaining_after_log_ms:maxDurationMs-elapsed-finishLogMs,automatic_retry:false,production_health:'unknown'};
}
