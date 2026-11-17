// Offline retention assessment; never deletes data.
const date=s=>{if(typeof s!=='string'||!/^\d{4}-\d\d-\d\dT/.test(s)||!/(Z|[+-]\d\d:\d\d)$/.test(s)||!Number.isFinite(Date.parse(s)))throw Error('invalid date');return Date.parse(s)};
export function assessCronAuditRetention({now,records,retentionDays=30,legalHold=false}){
 const n=date(now);
 if(!Array.isArray(records)||records.length>10000||!Number.isSafeInteger(retentionDays)||retentionDays<7||retentionDays>365||typeof legalHold!=='boolean')throw Error('invalid retention input');
 const eligible=[],retain=[];
 for(const record of records){
  if(!record||typeof record!=='object'||Object.keys(record).some(k=>!['event_id','at'].includes(k))||typeof record.event_id!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(record.event_id))throw Error('invalid record');
  const at=date(record.at);if(at>n)throw Error('future record');
  if(!legalHold&&n-at>retentionDays*86400000)eligible.push(record.event_id);else retain.push(record.event_id);
 }
 return {schema_version:1,eligible_for_operator_review:eligible,retained:retain,legal_hold:legalHold,
  actual_deletion_performed:false,storage_accessed:false,automatic_retry_allowed:false};
}
