// Recovery requires successive verified healthy observations; never triggers retries.
const validTime=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\dT/.test(s)&&/(Z|[+-]\d\d:\d\d)$/.test(s)&&Number.isFinite(Date.parse(s));
export function assessCronIncidentRecovery({observations,requiredHealthy=3,maxGapMs=2*3600000,referenceAt=null,maxObservationAgeMs=900000}){
 if(!Array.isArray(observations)||observations.length>100||!Number.isSafeInteger(requiredHealthy)||requiredHealthy<2||requiredHealthy>10||!Number.isSafeInteger(maxGapMs)||maxGapMs<3600000||!Number.isSafeInteger(maxObservationAgeMs)||maxObservationAgeMs<60000||maxObservationAgeMs>3600000||referenceAt!==null&&!validTime(referenceAt))throw Error('invalid recovery input');
 let consecutive=0,previous=null;const ref=referenceAt===null?null:Date.parse(referenceAt);
 for(const o of observations){
  if(!o||!validTime(o.at)||typeof o.healthy!=='boolean'||o.authenticated!==true&&o.authenticated!==false)throw Error('invalid observation');
  const at=Date.parse(o.at);
  if(previous!==null&&(at<=previous||at-previous>maxGapMs))throw Error('invalid observation order or gap');
  if(ref!==null&&at>ref)throw Error('future observation');
  previous=at;
  consecutive=o.healthy&&o.authenticated?consecutive+1:0;
 }
 const fresh=ref!==null&&previous!==null&&ref-previous<=maxObservationAgeMs;
 return {schema_version:1,healthy_streak:consecutive,evidence_fresh:fresh,recovery_proposal:fresh&&consecutive>=requiredHealthy?'manual_close_review':'keep_open',
  recovery_verified:false,incident_closed:false,automatic_retry_allowed:false,automatic_republish_allowed:false};
}
