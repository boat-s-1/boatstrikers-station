// Offline notification reservation decision. Real concurrency requires durable atomic storage.
const time=s=>{if(typeof s!=='string'||!/^\d{4}-\d\d-\d\dT/.test(s)||!/(Z|[+-]\d\d:\d\d)$/.test(s)||!Number.isFinite(Date.parse(s)))throw Error('invalid timestamp');return Date.parse(s)};
export function decideCronAlertReservation({incidentKey,now,existing=null,cooldownMs=3600000}){
 if(typeof incidentKey!=='string'||!/^[a-zA-Z0-9_-]{8,80}$/.test(incidentKey))throw Error('invalid incident key');
 const at=time(now);
 if(!Number.isSafeInteger(cooldownMs)||cooldownMs<3600000)throw Error('invalid cooldown');
 if(existing!==null){
  if(!existing||typeof existing!=='object'||existing.incident_key!==incidentKey||!['reserved','delivered','failed'].includes(existing.state))throw Error('invalid existing reservation');
  const previous=time(existing.at);
  if(previous>at)throw Error('future reservation');
  if(existing.state==='reserved')return {decision:'hold',reason:'already_reserved',actual_reservation_created:false,actual_alert_sent:false};
  if(at-previous<cooldownMs)return {decision:'hold',reason:'cooldown',actual_reservation_created:false,actual_alert_sent:false};
 }
 return {decision:'propose_atomic_reservation',reason:'operator_review_only',actual_reservation_created:false,actual_alert_sent:false};
}
