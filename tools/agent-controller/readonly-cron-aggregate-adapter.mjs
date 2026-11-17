// Strict offline adapter for sanitized, aggregate-only read-only evidence.
// Never connects to Supabase; accepts only allowlisted scalar counts and ISO timestamps.
const COUNTS=['runs_total','running_without_finish','partial_runs','windows_with_articles','temporal_article_matches'];
export function normalizeReadonlyCronAggregate(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('invalid aggregate input');
  const allowed=new Set(['observed_at','window_start','window_end',...COUNTS]);
  if(Object.keys(input).some(key=>!allowed.has(key)))throw Error('unexpected aggregate field');
  const dates={};
  for(const key of ['observed_at','window_start','window_end']){
    const value=input[key];
    if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT/.test(value)||!/(Z|[+-]\d\d:\d\d)$/.test(value)||!Number.isFinite(Date.parse(value)))throw Error('invalid '+key);
    dates[key]=value;
  }
  if(Date.parse(dates.window_start)>Date.parse(dates.window_end)||Date.parse(dates.window_end)>Date.parse(dates.observed_at))throw Error('invalid observation window');
  const counts={};
  for(const key of COUNTS){
    if(!Number.isSafeInteger(input[key])||input[key]<0)throw Error('invalid '+key);
    counts[key]=input[key];
  }
  if(counts.running_without_finish+counts.partial_runs>counts.runs_total||counts.windows_with_articles>counts.runs_total)throw Error('inconsistent aggregate counts');
  return {
    schema_version:1,kind:'readonly_cron_aggregate',...dates,counts,
    article_causality_verified:false,delivery_verified:false,
    input_authenticated:false,production_health:'unknown',
    automatic_replay_allowed:false
  };
}
