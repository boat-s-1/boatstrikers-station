// Pure offline stage telemetry schema. No wall-clock, network or database calls.
const STAGES=['collection','media','general','fallback','ai','finish_log'];
const OUTCOMES=new Set(['completed','failed','skipped_deadline','unknown']);
export function normalizeCronStageTelemetry({runKey,stages,maxDurationMs=60000}){
  if(typeof runKey!=='string'||!/^[-_A-Za-z0-9]{1,64}$/.test(runKey))throw Error('invalid run key');
  if(!Array.isArray(stages)||stages.length===0||stages.length>STAGES.length)throw Error('invalid stages');
  if(!Number.isSafeInteger(maxDurationMs)||maxDurationMs<=0)throw Error('invalid duration limit');
  const seen=new Set();let previous=-1;let knownDuration=0;let unknownCount=0;const output=[];
  for(const stage of stages){
    if(!stage||typeof stage!=='object'||Array.isArray(stage)||!STAGES.includes(stage.name)||seen.has(stage.name))throw Error('invalid stage name');
    const index=STAGES.indexOf(stage.name);
    if(index<=previous)throw Error('invalid stage order');
    previous=index;seen.add(stage.name);
    if(!OUTCOMES.has(stage.outcome))throw Error('invalid stage outcome');
    if(stage.durationMs!==null&&(!Number.isSafeInteger(stage.durationMs)||stage.durationMs<0))throw Error('invalid stage duration');
    if(stage.outcome==='skipped_deadline'&&stage.durationMs!==0)throw Error('skipped stage must have zero duration');
    if(stage.durationMs===null)unknownCount++;else knownDuration+=stage.durationMs;
    output.push({name:stage.name,outcome:stage.outcome,duration_ms:stage.durationMs});
  }
  return {
    schema_version:1,run_key:runKey,stages:output,known_stage_duration_ms:knownDuration,
    unknown_duration_stage_count:unknownCount,
    stage_budget_exceeded:knownDuration>maxDurationMs?'observed_sum_exceeds_limit':'not_proven',
    max_duration_ms:maxDurationMs,
    actual_wall_clock_duration_ms:null,
    finish_log_observed:seen.has('finish_log'),
    health:'unknown',automatic_retry:false
  };
}
