// Pure offline classifier. Accepts structured source outcomes, not raw error messages.
const SOURCES=['nikkan','macour','boatrace'];
const STATES=new Set(['ok','timeout','error','not_checked']);
export function classifyGeneralNewsSources(observations) {
  if(!observations||typeof observations!=='object'||Array.isArray(observations)||Object.keys(observations).some(k=>!SOURCES.includes(k))) throw Error('invalid source observations');
  const sources={};let failures=0,successes=0,unknown=0;
  for(const source of SOURCES){
    const status=observations[source]??'not_checked';
    if(!STATES.has(status)) throw Error('invalid source state');
    sources[source]=status;
    if(status==='ok')successes++;
    else if(status==='not_checked')unknown++;
    else failures++;
  }
  return {
    sources,
    known_successes:successes,
    known_failures:failures,
    unknown_sources:unknown,
    assessment:failures>0?'source_review_suggested':unknown>0?'insufficient_evidence':'sources_reported_ok',
    pipeline_health:'unknown',
    automatic_retries:false,
    automatic_repairs:false
  };
}
