// Compare independent scheduler and application evidence without declaring end-to-end success.
export function reconcileCronEvidence(input) {
 if(!input||typeof input!=='object'||Array.isArray(input)) throw Error('input required');
 const {scheduler,application}=input;
 if(!scheduler||!application||!Number.isSafeInteger(scheduler.succeeded)||!Number.isSafeInteger(scheduler.failed)||!Number.isSafeInteger(application.running)||!Number.isSafeInteger(application.partial)||[scheduler.succeeded,scheduler.failed,application.running,application.partial].some(x=>x<0)) throw Error('invalid evidence counts');
 const schedulerStatus=scheduler.failed>0?'failures_reported':scheduler.succeeded>0?'executions_succeeded':'not_checked';
 const applicationStatus=application.partial>0?'partial_errors_reported':application.running>0?'unfinished_records_reported':'not_checked';
 return {schema:'boatstrikers-cron-reconciliation-v1',scheduler_status:schedulerStatus,application_status:applicationStatus,end_to_end_status:'unknown',requires_manual_review:application.partial>0||application.running>0||scheduler.failed>0,automatic_repairs:false,live_checks_performed:false};
}
