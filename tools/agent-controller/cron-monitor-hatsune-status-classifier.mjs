// Offline-only classification of Hatsune NEWS Cron log rows.
// A missing completion marker is not proof of failed work.
const VALID=new Set(['running','success','partial','error']);
export function classifyHatsuneCronRun(run,{now,maxRunningMs=180000}={}){
 const hold=(reason)=>Object.freeze({classification:'verification_required',reason,confirmedFailure:false,alertEligible:false,writeAllowed:false});
 if(!run||typeof run!=='object'||!VALID.has(run.status))return hold('missing_or_unknown_status');
 const reference=Date.parse(now);
 const started=Date.parse(run.started_at);
 if(!Number.isFinite(reference)||!Number.isFinite(started)||started>reference||!Number.isSafeInteger(maxRunningMs)||maxRunningMs<60000)return hold('invalid_time_or_threshold');
 if(run.status==='running'){
  if(run.finished_at)return hold('inconsistent_running_finished');
  return hold(reference-started>maxRunningMs?'completion_unverified_stale':'still_within_observation_window');
 }
 const finished=Date.parse(run.finished_at);
 if(!Number.isFinite(finished)||finished<started||finished>reference)return hold('invalid_completion_timestamp');
 if(run.status==='error')return Object.freeze({classification:'reported_error',reason:'application_recorded_error',confirmedFailure:false,alertEligible:false,writeAllowed:false});
 if(run.status==='partial')return Object.freeze({classification:'reported_partial',reason:'application_recorded_partial',confirmedFailure:false,alertEligible:false,writeAllowed:false});
 return Object.freeze({classification:'reported_success',reason:'application_recorded_success',confirmedFailure:false,alertEligible:false,writeAllowed:false});
}
