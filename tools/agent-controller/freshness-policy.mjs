// Offline-only advisory policy. Never declares a service broken solely from age.
const names=['discord_deliveries','race_events','hatsune_news_cron_runs'];
export function evaluateFreshnessPolicy({assessment,policy}) {
 if(!assessment||assessment.schema!=='boatstrikers-record-age-v1') throw Error('invalid assessment');
 if(!policy||policy.schema!=='boatstrikers-freshness-policy-v1') throw Error('invalid policy');
 const result={};
 for(const name of names){
  const record=assessment.records?.[name];
  const setting=policy.services?.[name];
  if(!record||record.freshness==='not_checked'){result[name]={status:'not_checked',health:'unknown'};continue;}
  if(!setting||setting.enabled!==true){result[name]={status:'no_policy',health:'unknown'};continue;}
  if(typeof setting.expected_max_age_hours!=='number'||!Number.isFinite(setting.expected_max_age_hours)||setting.expected_max_age_hours<=0)throw Error('invalid threshold for '+name);
  if(record.freshness!=='age_only'||typeof record.age_hours!=='number'||!Number.isFinite(record.age_hours)||record.age_hours<0){result[name]={status:'insufficient_evidence',health:'unknown'};continue;}
  const overdue=record.age_hours>setting.expected_max_age_hours;
  result[name]={status:overdue?'review_suggested':'within_configured_window',health:'unknown',age_hours:record.age_hours,threshold_hours:setting.expected_max_age_hours};
 }
 return {schema:'boatstrikers-freshness-advisory-v1',services:result,automatic_alerts:false,automatic_repairs:false,live_checks_performed:false};
}
