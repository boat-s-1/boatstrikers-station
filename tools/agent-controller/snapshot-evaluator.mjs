// Offline-only evaluation of externally supplied observations. No fetch, credentials or writes.
const services=['discord','cron','race_db'];
export function evaluateSnapshot(snapshot) {
  if(!snapshot || typeof snapshot!=='object'||Array.isArray(snapshot)) throw Error('snapshot object required');
  if(snapshot.schema!=='boatstrikers-observation-v1') throw Error('unsupported schema');
  if(!['migration','verification','production','provider_restricted'].includes(snapshot.trinity_mode)) throw Error('invalid trinity mode');
  const results={};
  for(const service of services) {
    const item=snapshot.services?.[service];
    if(item===undefined||item===null) {results[service]={status:'not_checked',reason:'no_observation'};continue;}
    if(typeof item!=='object'||Array.isArray(item)||!['ok','error'].includes(item.result)) throw Error('invalid '+service+' observation');
    if(typeof item.observed_at!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(item.observed_at)||!Number.isFinite(Date.parse(item.observed_at))) throw Error('invalid '+service+' timestamp');
    // An observation is not automatically current: do not invent freshness thresholds.
    results[service]={status:item.result==='ok'?'reported_ok':'reported_error',observed_at:item.observed_at,reason:'unverified_external_observation'};
  }
  const paused=['migration','provider_restricted'].includes(snapshot.trinity_mode);
  return {schema:'boatstrikers-assessment-v1',trinity:{mode:snapshot.trinity_mode,status:paused?'planned_pause':'requires_evidence'},services:results,live_checks_performed:false,automatic_repairs:false,api_requests:0,production_writes:0};
}
