// Pure sanitized audit record: no raw SQL, credentials, user data, or delivery payload.
const KINDS=new Set(['fetch_attempt','fetch_result','incident_proposed','alert_reservation','delivery_receipt','recovery_review','kill_switch']);
const STATES=new Set(['ok','hold','failed','unknown']);
export function normalizeCronMonitorAuditEnvelope(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('invalid audit input');
 const allowed=new Set(['eventId','correlationId','at','kind','state','code']);
 if(Object.keys(input).some(k=>!allowed.has(k)))throw Error('unexpected audit field');
 const {eventId,correlationId,at,kind,state,code}=input;
 if(![eventId,correlationId].every(s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{8,80}$/.test(s)))throw Error('invalid audit id');
 if(typeof at!=='string'||!/^\d{4}-\d\d-\d\dT/.test(at)||!/(Z|[+-]\d\d:\d\d)$/.test(at)||!Number.isFinite(Date.parse(at)))throw Error('invalid audit time');
 if(!KINDS.has(kind)||!STATES.has(state)||typeof code!=='string'||!/^[a-z0-9_]{2,48}$/.test(code))throw Error('invalid audit status');
 return {schema_version:1,event_id:eventId,correlation_id:correlationId,at,kind,state,code,
  contains_raw_article_data:false,contains_credentials:false,delivery_authenticated:false,persisted:false};
}
