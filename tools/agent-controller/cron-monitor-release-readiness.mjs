import {validateCronMonitorConfig} from './cron-monitor-config.mjs';
import {assessCronMonitorKillSwitch} from './cron-monitor-kill-switch.mjs';
// Review-only synthesis. This function never activates monitoring.
export function assessCronMonitorReleaseReadiness({config={},switchState={},testsPassed=false,independentSecurityReview=false,notificationSandboxPassed=false,sqlRuntimeMeasured=false}={}){
 for(const v of [testsPassed,independentSecurityReview,notificationSandboxPassed,sqlRuntimeMeasured])if(typeof v!=='boolean')throw Error('invalid readiness flag');
 const cfg=validateCronMonitorConfig(config);
 const stop=assessCronMonitorKillSwitch(switchState);
 const blockers=[...cfg.missing_gates,...stop.reasons];
 if(!testsPassed)blockers.push('offline_tests_unverified');
 if(!independentSecurityReview)blockers.push('security_review_missing');
 if(!notificationSandboxPassed)blockers.push('notification_sandbox_missing');
 if(!sqlRuntimeMeasured)blockers.push('query_runtime_unmeasured');
 return {schema_version:1,review_status:blockers.length?'hold':'ready_for_separate_explicit_production_approval',
  blockers:[...new Set(blockers)],offline_tests_reported:testsPassed,
  actual_monitor_enabled:false,production_deployed:false,approval_granted:false,automatic_retry_allowed:false};
}
