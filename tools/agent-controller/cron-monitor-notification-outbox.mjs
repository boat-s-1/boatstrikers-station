// Strict outbound payload proposal. No destination, token or message text accepted.
const valid=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{8,80}$/.test(s);
const CODES=new Set(['timeout','connection_error','permission_denied','invalid_result','policy_hold']);
export function buildCronNotificationOutboxProposal({incidentKey,attemptId,reason,approvedDestination=false,atomicReservationConfirmed=false,operatorApproval=false}){
 if(!valid(incidentKey)||!valid(attemptId)||!CODES.has(reason))throw Error('invalid outbox proposal');
 for(const x of [approvedDestination,atomicReservationConfirmed,operatorApproval])if(typeof x!=='boolean')throw Error('invalid approval flag');
 const blockers=[];
 if(!approvedDestination)blockers.push('destination_unapproved');
 if(!atomicReservationConfirmed)blockers.push('atomic_reservation_unverified');
 if(!operatorApproval)blockers.push('operator_approval_missing');
 return {schema_version:1,incident_key:incidentKey,attempt_id:attemptId,reason,
  proposed_message_code:'cron_aggregate_'+reason,
  readiness:blockers.length?'hold':'eligible_for_separate_operator_review',blockers,
  recipient_included:false,credentials_included:false,article_data_included:false,
  outbox_persisted:false,notification_sent:false,delivery_verified:false,
  automatic_retry_allowed:false,automatic_republish_allowed:false};
}
