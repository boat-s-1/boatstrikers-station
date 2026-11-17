// Pure lease policy; not a lock or transaction.
const parse=s=>{if(typeof s!=='string'||!/^\d{4}-\d\d-\d\dT/.test(s)||!/(Z|[+-]\d\d:\d\d)$/.test(s)||!Number.isFinite(Date.parse(s)))throw Error('invalid timestamp');return Date.parse(s)};
export function assessCronMonitorLease({now,lease=null,leaseDurationMs=120000,operatorOverride=false}){
 const n=parse(now);if(!Number.isSafeInteger(leaseDurationMs)||leaseDurationMs<60000||leaseDurationMs>300000||typeof operatorOverride!=='boolean')throw Error('invalid lease configuration');
 if(lease===null)return {decision:'propose_atomic_claim',reason:'unreserved',actual_claim_created:false,automatic_send_allowed:false};
 if(!lease||typeof lease!=='object'||!['reserved','delivered','failed'].includes(lease.state)||typeof lease.owner_id!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(lease.owner_id))throw Error('invalid lease');
 const start=parse(lease.at);if(start>n)throw Error('future lease');
 if(lease.state==='delivered')return {decision:'hold',reason:'already_delivered',actual_claim_created:false,automatic_send_allowed:false};
 if(lease.state==='failed')return {decision:'hold',reason:'manual_failure_review',actual_claim_created:false,automatic_send_allowed:false};
 if(n-start<leaseDurationMs)return {decision:'hold',reason:'active_lease',actual_claim_created:false,automatic_send_allowed:false};
 return {decision:operatorOverride?'manual_takeover_review':'hold',reason:'expired_lease_uncertain_delivery',actual_claim_created:false,automatic_send_allowed:false};
}
