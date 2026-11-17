// Fail-closed validation of an externally supplied read-only monitoring snapshot.
// Pure function: no network, credentials, database access, or side effects.
export function assessCronMonitorSnapshot({snapshot,referenceAt,maxAgeMs=300000}={}) {
 const hold=(reason)=>Object.freeze({decision:'hold',reason,notificationAllowed:false,writeAllowed:false});
 if(!Number.isFinite(referenceAt)||referenceAt<0) return hold('invalid_reference_time');
 if(!Number.isInteger(maxAgeMs)||maxAgeMs<=0||maxAgeMs>3600000) return hold('invalid_age_policy');
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)) return hold('missing_snapshot');
 const {capturedAt,source,readonlyVerified,queryFingerprint,records}=snapshot;
 if(!Number.isFinite(capturedAt)||capturedAt>referenceAt) return hold('invalid_capture_time');
 if(referenceAt-capturedAt>maxAgeMs) return hold('stale_snapshot');
 if(source!=='cron_aggregate_readonly'||readonlyVerified!==true) return hold('unverified_readonly_source');
 if(typeof queryFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(queryFingerprint)) return hold('missing_query_fingerprint');
 if(!Array.isArray(records)||records.length>1000) return hold('invalid_record_count');
 const seen=new Set();
 for(const r of records){
  if(!r||typeof r!=='object'||Array.isArray(r)) return hold('invalid_record');
  if(typeof r.attemptId!=='string'||!/^[-_a-zA-Z0-9]{1,128}$/.test(r.attemptId)||seen.has(r.attemptId)) return hold('invalid_or_duplicate_attempt');
  seen.add(r.attemptId);
  if(!['completed','partial','unfinished'].includes(r.status)) return hold('invalid_status');
  if(!Number.isFinite(r.startedAt)||r.startedAt>capturedAt||r.startedAt<0) return hold('invalid_start_time');
 }
 return Object.freeze({decision:'eligible_for_offline_review',reason:'validated_shape_only',recordCount:records.length,notificationAllowed:false,writeAllowed:false});
}
