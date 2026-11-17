// Pure offline freshness assessment. Never infer service health from record age alone.
const SOURCES=['discord_deliveries','race_events','hatsune_news_cron_runs'];
export function assessRecordAge(input) {
  if(!input||typeof input!=='object'||Array.isArray(input)) throw Error('input object required');
  const {as_of,records}=input;
  const now=Date.parse(as_of);
  if(typeof as_of!=='string'||!Number.isFinite(now)||!as_of.endsWith('Z')) throw Error('UTC as_of required');
  if(!records||typeof records!=='object'||Array.isArray(records)) throw Error('records object required');
  const output={};
  for(const source of SOURCES) {
    const item=records[source];
    if(item===undefined||item===null){output[source]={freshness:'not_checked',health:'unknown'};continue;}
    if(typeof item!=='object'||Array.isArray(item)||!Number.isSafeInteger(item.rows_total)||item.rows_total<0) throw Error('invalid row count: '+source);
    const timestamp=item.latest_observed_at;
    if(timestamp===null && item.rows_total===0){output[source]={freshness:'no_records',health:'unknown',rows_total:0};continue;}
    if(typeof timestamp!=='string'||!Number.isFinite(Date.parse(timestamp))||!(/Z$|[+-]\d{2}:\d{2}$/.test(timestamp))) throw Error('invalid timestamp: '+source);
    const delta=now-Date.parse(timestamp);
    if(delta<0) throw Error('future observation: '+source);
    output[source]={freshness:'age_only',age_hours:Math.round(delta/3600000*100)/100,rows_total:item.rows_total,health:'unknown'};
  }
  return {schema:'boatstrikers-record-age-v1',as_of,records:output,thresholds_applied:false,live_checks_performed:false,automatic_repairs:false};
}
